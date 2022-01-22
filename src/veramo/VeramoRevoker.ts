import { EthrStatusRegistry, EthrCredentialRevoker } from "ethr-status-registry";
import { Status, CredentialStatus } from "credential-status";
import { agent } from "./setup";
import { sign } from "ethjs-signer"
import { IIdentifier, IKey, VerifiableCredential } from "@veramo/core";

// TODO: Think about allowing jwt token instead of hash
export class VeramoRevoker {
  credentialPromise: Promise<VerifiableCredential>;
  status: Status;

  constructor(hash: string) {
    this.status = new Status({
      ...new EthrStatusRegistry({ infuraProjectId: "f8cacc18b6d34b19811efe74ac9a64da" }).asStatusMethod,
    });
    this.credentialPromise = agent.dataStoreGetVerifiableCredential({
      hash: hash,
    });
  }

  async getEthrCredentialStatus(): Promise<CredentialStatus> {
    const credential: VerifiableCredential = await this.credentialPromise;
    const resolvedDid = await agent.resolveDid({ didUrl: credential.credentialSubject.id as string });
    const didDoc: any = resolvedDid.didDocument; // needs to be any as DIDDocument type doesn't match between lib and Veramo anymore

    /**
     * Restructure didDoc -> extremly hacky
     * libs expect a set of parameters like publicKey field and
     * type: Secp256k1VerificationKey2018 and ethereumAddress
     */
    didDoc.publicKey = [
      {
        id: `${didDoc.verificationMethod[0].id}#controller`,
        controller: didDoc.verificationMethod[0].id,
        type: "Secp256k1VerificationKey2018",
        ethereumAddress: didDoc.verificationMethod[0].blockchainAccountId.split("@")[0],
      },
    ];

    const isRevoked = await this.status.checkStatus(credential.proof.jwt, didDoc);
    return isRevoked as CredentialStatus;
  }

  async revokeEthrCredential(): Promise<string> {
    const credential: VerifiableCredential = await this.credentialPromise;
    const identifier: IIdentifier = await agent.didManagerGet({ did: credential.credentialSubject.id as string});
    const keys: IKey = await agent.keyManagerGet({ kid: identifier.controllerKeyId as string });

    const ethSigner = (rawTx: any, cb: any) => cb(null, sign(rawTx, `0x${keys.privateKeyHex}`));
    const revoker = new EthrCredentialRevoker({ infuraProjectId: process.env.INFURA_PROJECT_ID });
    const txHash = await revoker.revoke(credential.proof.jwt, ethSigner, { gasLimit: 1000000 });
    return txHash;
  }
}
