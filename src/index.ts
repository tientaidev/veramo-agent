import express from "express";
import bodyParser from "body-parser";
import { IssueCredentialResponse, GenericResult } from "./veramo/ServiceProviderTypes";
import { VeramoProvider } from "./veramo/VeramoProvider";
import { VeramoDatabase, VeramoDatabaseCredential } from "./veramo/VeramoDatabase";
import { RevocationResult } from "./veramo/ServiceProviderTypes";
import { agent } from "./veramo/setup";
import { MessagingRouter, RequestWithAgentRouter } from "@veramo/remote-server";

import { W3CCredential } from "@veramo/core";

const app = express();
const veramo = VeramoProvider.getInstance();
const db = new VeramoDatabase();

const requestWithAgent = RequestWithAgentRouter({ agent });
const messagingRouter = MessagingRouter({
  metaData: { type: 'DIDComm', value: 'integration test' },
})

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/dids", async (req, res) => {
  const identifiers = await veramo.getDids();
  res.send({ identifiers });
})

app.get("/dids/create", async (req, res) => {
  const identifier = await veramo.createDid();
  res.send({ identifier });
})

app.get("/dids/delete", async (req, res) => {
  const did: string = req.query.did as string;

  try {
    const result = await veramo.deleteDid(did);
    res.status(200).send({ result });
  } catch (error) {
    res.status(400).send({ error: error });
  }
})

app.get("/dids/resolve", async (req, res) => {
  const did = req.query.did as string;
  const didDocument = await veramo.resolveDid(did);
  res.send(didDocument);
})

app.post("/dids/add-service", async (req, res) => {
  const result = await veramo.addServiceDid(req.body);
  res.send(result);
})

app.get("/credentials/", async (req, res) => {
  const vcs: [VeramoDatabaseCredential] = await db.getAllCredentials();
  res.send(vcs);
})

app.post("/credentials/issue", async (req, res) => {
  const credential: IssueCredentialResponse | Buffer = await veramo.issueVerifiableCredential(
    req.body,
    req.query.toRemote === "true"
  );

  if (credential instanceof Error) {
    res.status(500).send(<GenericResult>{ success: false, error: credential.message });
  } else if (credential instanceof Buffer) {
    res.type("png");
    res.status(200).send(credential);
  } else {
    res.status(201).send(credential);
  }
})

app.post("/credentials/transfer", async (req, res) => {
  const result = await veramo.transferVerifiableCredential(req.body);
  if (result instanceof Error) {
    res.status(500).send(<GenericResult>{ success: false, error: result.message });
  } else {
    res.status(200).send(result);
  }
})

app.delete("/credentials/delete", async (req, res) => {
  const hash = req.query.hash as string;
  const isExecuted = await db.deleteCredential(hash);
  res.send(isExecuted);
})

app.post("/credentials/revoke", async (req, res) => {
  const result: RevocationResult = await veramo.revokeVerifiableCredential(req.body);
  res.status(200).send(result);
})

app.post("/credentials/is-revoked", async (req, res) => {
  const result = await veramo.checkStatusVerifiableCredential(req.body.credentialId);
  res.status(200).send(result);
})

app.post("/credentials/verify", async (req, res) => {
  const result: GenericResult = await veramo.verifyVerifiableCredential(req.body.verifiableCredential);
  if (result instanceof Error) {
    res.status(500).send(<GenericResult>{ success: false, error: result.message });
  } else {
    res.status(200).send(result);
  }
})

app.post("/test/send-message", async (req, res) => {
  const sender: string = req.body.sender as string;
  const receiver: string = req.body.receiver as string;

  const message = {
    type: 'test',
    from: sender,
    to: receiver,
    id: 'test-jws-success2',
    body: { hello: 'world' },
  }

  console.log("message:")
  console.log(message);

  try {
    const packedMessage = await agent.packDIDCommMessage({
      packing: 'jws',
      message,
    });

    console.log("Packed message");
    console.log(packedMessage);

    const result = await agent.sendDIDCommMessage({
      messageId: '123',
      packedMessage,
      recipientDidUrl: receiver,
    })

    console.log(`message send result: ${result}`);
    res.send(true);
  } catch (error) {
    console.log(error);
    res.send(false);
  }
})

app.post("/test/transferVC", async (req, res) => {
  const receiver: string = "did:ethr:rinkeby:0x0268f813e88c0b46254a2737a6e9d1f4d84c07c58126e0e6bfdf7510c626b5743f";
  const credential: W3CCredential = {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "id": "126",
    "type": [
      "VerifiableCredential",
      "Profile"
    ],
    "issuer": {
      "id": "did:ethr:rinkeby:0x038c511b7342b7bcc47e9a0c27a6146b7f6d2d59f4f4272cfa80114450c97cf019"
    },
    "issuanceDate": "2010-01-01T19:23:24Z",
    "credentialSubject": {
      "id": receiver,
      "name": "Foobar",
      "major": "Computer Science"
    },
    "credentialStatus": {
      "type": "EthrStatusRegistry2019",
      "id": "126"
    }
  };

  const verifiableCredential: W3CCredential = await agent.createVerifiableCredential({
    save: false,
    credential,
    proofFormat: "jwt",
  });

  const message = {
    type: 'test',
    from: 'did:ethr:rinkeby:0x038c511b7342b7bcc47e9a0c27a6146b7f6d2d59f4f4272cfa80114450c97cf019',
    to: receiver,
    id: '127',
    body: verifiableCredential
  };

  try {
    const packedMessage = await agent.packDIDCommMessage({
      message,
      packing: 'jws'
    })
  
    await agent.sendDIDCommMessage({
      messageId: '123',
      packedMessage,
      recipientDidUrl: receiver,
    })

    res.status(200).send(true);
  } catch (error) {
    console.log(error);
    res.status(400).send(false);
  }
})

app.post("/test/handleMessage", async (req, res) => {
  try {
    await agent.handleMessage({
      raw: req.body.raw,
      save: false
    })

    res.send(true);
  } catch (error) {
    console.log(error);
    res.send(false);
  }
  
})

app.use("/messaging", requestWithAgent, messagingRouter);



app.listen(3000, () => console.log("App listen at port 3000"));
