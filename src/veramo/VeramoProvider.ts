import { agent } from "./setup";
import { 
  IIdentifier, 
  W3CCredential, 
  VerifiableCredential, 
  VerifiablePresentation 
} from "@veramo/core";
import { CredentialStatus } from "credential-status";
import { VeramoRevoker } from "./VeramoRevoker";
import { 
  IssueCredentialRequest, 
  IssueCredentialResponse,
  GenericMessage,
  GenericResult,
  CredentialDeleteResult,
  AddServiceRequest,
  RevocationRequest,
  RevocationResult,
  RevocationStatus
} from "./ServiceProviderTypes";

export class VeramoProvider {

  private static instance: VeramoProvider;

  private constructor() {}

  public static getInstance(): VeramoProvider {
    if (!VeramoProvider.instance) {
      VeramoProvider.instance = new VeramoProvider();
    }
    return VeramoProvider.instance;
  }

  async getDids(): Promise<IIdentifier[]> {
    const identifiers = await agent.didManagerFind();
    return identifiers;
  }

  async createDid(): Promise<IIdentifier> {
    const identity = await agent.didManagerCreate();
    return identity;
  }

  async deleteDid(did: string): Promise<boolean> {
    const identity = await agent.didManagerDelete({ did: did });
    return identity;
  }

  async resolveDid(did: string) {
    const didDocument = await agent.resolveDid({
      didUrl: did,
    });
    return didDocument;
  }

  async issueVerifiableCredential(body: IssueCredentialRequest, toWallet: boolean): Promise<IssueCredentialResponse> {
    try {
      body.credential.issuer = { id: body.credential.issuer.toString() };
      const credential: W3CCredential = body.credential;
      const save: boolean = body.options?.save ? body.options.save : false;

      const verifiableCredential: W3CCredential = await agent.createVerifiableCredential({
        save: save,
        credential,
        proofFormat: "jwt",
      });

      // Prepare response
      const result: IssueCredentialResponse = {
        credential: verifiableCredential,
      };

      if (toWallet) {
        // Send VC to another Veramo agent
        try {
          await agent.sendMessageDIDCommAlpha1({
            save: true,
            data: {
              from: verifiableCredential.issuer.id,
              to: verifiableCredential.credentialSubject.id,
              type: "jwt",
              body: verifiableCredential.proof.jwt,
            },
          });

          result.sent = true;
          return result;
        } catch (error) {
          return error as any;
        }
      }
      return result;
    } catch (error) {
      return error as any;
    }
  }

  async verifyVerifiableCredential(vc: W3CCredential): Promise<GenericResult> {
    const result: GenericResult = {
      success: false,
    };
    try {
      const message = await agent.handleMessage({
        raw: vc.proof.jwt,
      });

      // Implement some checking here

      result.success = true;
      return result;
    } catch (error) {
      result.success = false;
      result.error = (error as Error).message;
      return result;
    }
  }

  async revokeVerifiableCredential(revocationBody: RevocationRequest): Promise<RevocationResult> {
    const revoker = new VeramoRevoker(revocationBody.credentialId);
    const result: RevocationResult = { status: null as any };
    if (
      revocationBody.credentialStatus[0].type !== "EthrStatusRegistry2019" ||
      revocationBody.credentialStatus[0].status !== "1"
    ) {
      result.status = RevocationStatus['NOT_REVOKED'];
      result.message = "Unsupported type or status.";
      return result;
    } else {
      try {
        const txHash = await revoker.revokeEthrCredential();
        console.log(txHash);
        result.status = RevocationStatus['PENDING'];
        result.message = txHash;
        return result;
      } catch(error) {
        result.status = RevocationStatus["NOT_REVOKED"]
        result.message = (error as Error).message;
        return result;
      }
    }
  }

  async transferVerifiableCredential(request: GenericMessage): Promise<GenericResult> {
    try {
      const vc: VerifiableCredential = request.body?.credential as VerifiableCredential;
      console.log(vc);

      // Prepare a second mandate VC
      const credentialHolder = JSON.parse(JSON.stringify(vc.credentialSubject)); // deep clone
      credentialHolder.id = request.to;
      console.log(vc.credentialSubject.id);
      const mandateCredential: W3CCredential = {
        "@context": vc["@context"],
        type: vc.type,
        issuanceDate: new Date().toISOString(),
        expirationDate: new Date(new Date().getTime() + 86400000).toISOString(), // 1 day in future
        issuer: { id: vc.credentialSubject.id as string },
        credentialSubject: credentialHolder,
      };
      
      console.log("mandate credential");
      console.log(mandateCredential);

      // Create a second mandate VC
      const mandateVC: VerifiableCredential = await agent.createVerifiableCredential({
        save: false,
        credential: mandateCredential,
        proofFormat: "jwt",
      });

      // Create a VP containing the original VC + mandate VC from subject
      const vp: VerifiablePresentation = await agent.createVerifiablePresentation({
        presentation: {
          holder: vc.credentialSubject.id,
          issuanceDate: new Date().toISOString(),
          type: ["VerifiablePresentation"],
          verifier: [request.to as string],
          verifiableCredential: [vc, mandateVC],
        },
        save: false,
        proofFormat: "jwt",
      });

      // Send VP
      const msgBody = {
        from: request.from,
        to: request.to,
        type: "jwt",
        body: vp.proof.jwt,
      };

      console.log("msgBody");
      console.log(msgBody);

      // await agent.sendMessageDIDCommAlpha1({ data: msgBody });
      const packedMessage = await agent.packDIDCommMessage({
        packing: 'jws',
        msgBody
      });

      console.log("packed message:")
      console.log(packedMessage);
      
      await agent.sendDIDCommMessage({
        messageId: '123',
        packedMessage,
        recipientDidUrl: request.to,
      })

      const result: GenericResult = { success: true };
      return result;
    } catch (error) {
      const result: GenericResult = { success: false };
      console.log(error);
      result.error = (error as Error).message
      return result;
    }
  }

  async checkStatusVerifiableCredential(credentialId: string): Promise<boolean> {
    const revoker = new VeramoRevoker(credentialId);
    const result: CredentialStatus =  await revoker.getEthrCredentialStatus();
    return result.revoked as boolean;
  }

  async addServiceDid(body: AddServiceRequest): Promise<GenericResult> {
    const result: GenericResult = {
      success: false
    }

    try {
      await agent.didManagerAddService(body);
      result.success = true;
      return result;
    } catch(error) {
      result.success = false;
      result.error = (error as Error).message;
    }
    
    return result;
  }
}