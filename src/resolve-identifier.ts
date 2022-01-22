import { agent } from './veramo/setup'

async function main() {
  const didUrl = "did:ethr:rinkeby:0x038c511b7342b7bcc47e9a0c27a6146b7f6d2d59f4f4272cfa80114450c97cf019";
  const didDocument = (await agent.resolveDid({ didUrl })).didDocument;
  console.log(didDocument);
}

main().catch(console.log)