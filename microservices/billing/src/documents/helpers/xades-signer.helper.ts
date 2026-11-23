import { randomInt } from 'crypto';
import * as forge from 'node-forge';

const NS_DS = 'http://www.w3.org/2000/09/xmldsig#';
const NS_ETSI = 'http://uri.etsi.org/01903/v1.3.2#';
const NS = `xmlns:ds="${NS_DS}" xmlns:etsi="${NS_ETSI}"`;

const sha1b64 = (data: string) => {
  const md = forge.md.sha1.create();
  md.update(data, 'utf8');
  return forge.util.encode64(md.digest().getBytes());
};
const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rnd = () => randomInt(100000, 999999);

/** canon: con namespaces (para el hash). inline: sin ellos (para el documento). */
function el(name: string, attrs: string, inner: string) {
  return {
    canon: `<${name} ${NS}${attrs ? ' ' + attrs : ''}>${inner}</${name}>`,
    inline: `<${name}${attrs ? ' ' + attrs : ''}>${inner}</${name}>`,
  };
}

const digestRef = (attrs: string, inner = '') =>
  `<ds:Reference ${attrs}>${inner}` +
  `<ds:DigestMethod Algorithm="${NS_DS}sha1"></ds:DigestMethod>`;

function loadP12(p12: Buffer, password: string) {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12.toString('binary')));
  const p12o = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  const keyBags = p12o.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ];
  const key = keyBags?.[0]?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!key) throw new Error('El .p12 no contiene llave privada.');

  const certs = (p12o.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert)
    .filter(Boolean) as forge.pki.Certificate[];

  // el certificado correcto es el que corresponde a la llave privada (no el de la CA)
  const cert = certs.find(
    (c) => (c.publicKey as forge.pki.rsa.PublicKey).n.compareTo(key.n) === 0,
  );
  if (!cert) throw new Error('No se encontró el certificado de la firma.');
  return { key, cert };
}

const bigToB64 = (n: forge.jsbn.BigInteger) => {
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  return forge.util.encode64(forge.util.hexToBytes(hex));
};

export function signXadesBes(xml: string, p12: Buffer, password: string): string {
  const { key, cert } = loadP12(p12, password);

  // el documento se firma sin la declaración <?xml ?>
  const body = xml.replace(/^<\?xml[^>]*\?>/, '');
  const closing = body.lastIndexOf('</');
  if (closing < 0) throw new Error('XML inválido.');

  const sigId = `Signature${rnd()}`;
  const signedInfoId = `Signature-SignedInfo${rnd()}`;
  const sigValueId = `SignatureValue${rnd()}`;
  const keyInfoId = `Certificate${rnd()}`;
  const spId = `${sigId}-SignedProperties${rnd()}`;
  const refDocId = `Reference-ID-${rnd()}`;
  const objectId = `${sigId}-Object${rnd()}`;

  // SignedProperties
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certMd = forge.md.sha1.create();
  certMd.update(certDer);
  const certDigest = forge.util.encode64(certMd.digest().getBytes());

  const issuerName = [...cert.issuer.attributes]
    .reverse()
    .map((a) => `${a.shortName}=${a.value}`)
    .join(',');
  const serial = BigInt('0x' + cert.serialNumber).toString();

  const signedProps = el(
    'etsi:SignedProperties',
    `Id="${spId}"`,
    '<etsi:SignedSignatureProperties>' +
      `<etsi:SigningTime>${new Date().toISOString().replace(/\.\d{3}Z$/, '-00:00')}</etsi:SigningTime>` +
      '<etsi:SigningCertificate><etsi:Cert><etsi:CertDigest>' +
      `<ds:DigestMethod Algorithm="${NS_DS}sha1"></ds:DigestMethod>` +
      `<ds:DigestValue>${certDigest}</ds:DigestValue></etsi:CertDigest>` +
      `<etsi:IssuerSerial><ds:X509IssuerName>${xmlEsc(issuerName)}</ds:X509IssuerName>` +
      `<ds:X509SerialNumber>${serial}</ds:X509SerialNumber></etsi:IssuerSerial>` +
      '</etsi:Cert></etsi:SigningCertificate></etsi:SignedSignatureProperties>' +
      '<etsi:SignedDataObjectProperties>' +
      `<etsi:DataObjectFormat ObjectReference="#${refDocId}">` +
      '<etsi:Description>contenido comprobante</etsi:Description>' +
      '<etsi:MimeType>text/xml</etsi:MimeType></etsi:DataObjectFormat>' +
      '</etsi:SignedDataObjectProperties>',
  );

  // KeyInfo
  const pub = cert.publicKey as forge.pki.rsa.PublicKey;
  const keyInfo = el(
    'ds:KeyInfo',
    `Id="${keyInfoId}"`,
    `<ds:X509Data><ds:X509Certificate>${forge.util.encode64(certDer)}</ds:X509Certificate></ds:X509Data>` +
      `<ds:KeyValue><ds:RSAKeyValue><ds:Modulus>${bigToB64(pub.n)}</ds:Modulus>` +
      `<ds:Exponent>${bigToB64(pub.e)}</ds:Exponent></ds:RSAKeyValue></ds:KeyValue>`,
  );

  // SignedInfo
  const signedInfo = el(
    'ds:SignedInfo',
    `Id="${signedInfoId}"`,
    `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></ds:CanonicalizationMethod>` +
      `<ds:SignatureMethod Algorithm="${NS_DS}rsa-sha1"></ds:SignatureMethod>` +
      digestRef(`Id="SignedPropertiesID${rnd()}" Type="http://uri.etsi.org/01903#SignedProperties" URI="#${spId}"`) +
      `<ds:DigestValue>${sha1b64(signedProps.canon)}</ds:DigestValue></ds:Reference>` +
      digestRef(`URI="#${keyInfoId}"`) +
      `<ds:DigestValue>${sha1b64(keyInfo.canon)}</ds:DigestValue></ds:Reference>` +
      digestRef(
        `Id="${refDocId}" URI="#comprobante"`,
        `<ds:Transforms><ds:Transform Algorithm="${NS_DS}enveloped-signature"></ds:Transform></ds:Transforms>`,
      ) +
      `<ds:DigestValue>${sha1b64(body)}</ds:DigestValue></ds:Reference>`,
  );

  // firma RSA-SHA1 del SignedInfo canónico
  const md = forge.md.sha1.create();
  md.update(signedInfo.canon, 'utf8');
  const signatureValue = forge.util.encode64(key.sign(md));

  const signature =
    `<ds:Signature ${NS} Id="${sigId}">` +
    signedInfo.inline +
    `<ds:SignatureValue Id="${sigValueId}">${signatureValue}</ds:SignatureValue>` +
    keyInfo.inline +
    `<ds:Object Id="${objectId}"><etsi:QualifyingProperties Target="#${sigId}">` +
    signedProps.inline +
    '</etsi:QualifyingProperties></ds:Object></ds:Signature>';

  // la firma va dentro del comprobante, antes del cierre de la raíz
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    body.slice(0, closing) +
    signature +
    body.slice(closing)
  );
}