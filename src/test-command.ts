import { agent } from './veramo/setup'

async function main() {
  const didUrl = "did:ethr:rinkeby:0x038c511b7342b7bcc47e9a0c27a6146b7f6d2d59f4f4272cfa80114450c97cf019";
  const did = await agent.didManagerGet({ did: didUrl });
  console.log("==== Get identifier ====");
  console.log(did);


  // create verifiable credential
  const subjectDidUrl = "did:ethr:rinkeby:0x03ae33b6e2e41326e8295f4044b05f590064d6cbefd775a2a74edc6541d8f8246b";
  // const verifiableCredential = await agent.createVerifiableCredential({
  //   credential: {
  //     issuer: { id: didUrl },
  //     '@context': ['https://www.w3.org/2018/credentials/v1'],
  //     type: ['VerifiableCredential'],
  //     issuanceDate: new Date().toISOString(),
  //     credentialSubject: {
  //       id: subjectDidUrl,
  //       name: 'Tien Tai',
  //       major: 'Computer Science'
  //     },
  //   },
  //   proofFormat: 'jwt',
  //   save: true,
  // });
  // console.log(verifiableCredential);

  // get verifiable credential
  console.log("==== Verifiable Credential ====");
  const verifiableCredential = await agent.dataStoreGetVerifiableCredential({
    hash: "62311f96cbee41838a0c29ac1379a29cf3649444d0515c72dcc4d93e595b8337f3ea93934850f7f50d601a2ed1239e04fa13972823730d27a8b36f626250e757"
  });
  console.log(verifiableCredential);

  
}

main().catch(console.log)