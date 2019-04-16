const assert = require('assert');
const jwa = require('jwa');
const { Buffer } = require('safe-buffer');
const ecdsa = jwa('ES256');

/**
 * @typedef TokenParts
 * @property {String} payload
 * @property {String} signature
 */

/**
 * Parses a public or private ECDSA key from a file or string
 * @param {String|Buffer} key
 * @return {String}
 */
const parseKey = (key) => {
  if (Buffer.isBuffer(key)) {
    key = key.toString();
  }
  return key;
};

/**
 * Splits a token to its payload and signature parts
 * @param {String} token
 * @return {TokenParts}
 */
const extractParts = token => (input => ({
  payload: input.substr(86),
  signature: input.substr(0, 86)
}))(String(token));

/**
 * @param {String} token
 * @param {String} publicKey
 * @return {Object}
 */
const tokenParser = (token, publicKey) => {
  const userData = {};
  try {
    const { payload, signature } = extractParts(token);

    assert(ecdsa.verify(payload, signature, publicKey));

    const json = Buffer.from(payload, 'base64').toString();
    Object.assign(userData, JSON.parse(json));
  } catch (e) { }

  return userData;
};

/**
 * Initializes a new token parser
 * @param {String|Buffer} publicKey PEM-formatted public key
 * @return {Function} Token parser function
 */
const parser = publicKey => {
  publicKey = parseKey(publicKey);
  assert(typeof publicKey === 'string', 'A valid public key must be supplied in order to verify incoming tokens');

  return token => tokenParser(token, publicKey);
};

/**
 * Generates a token from a payload
 * @param {*} payload
 * @param {String|Buffer} privateKey
 * @return {String}
 */
const sign = (payload, privateKey) => {
  privateKey = parseKey(privateKey);
  const json = JSON.stringify(payload);
  const payload = Buffer.from(json).toString('base64');
  const signature = ecdsa.sign(payload, privateKey);
  return `${signature}${payload}`;
};

/**
 * @param {Function} tokenParser
 * @param {String} headerName
 */
const middleware = (req, res, next, tokenParser, headerName) => {
  req.tokenData = tokenParser(req.get(headerName));
  next();
};

/**
 * Creates an Express 4.x middleware that automatically parses signed tokens in request headers
 * @param {String} publicKey PEM-formatted public key
 * @param {String} headerName Name of the request header
 * @return {Function} Express 4.x middleware
 */
const tokenData = (publicKey, headerName = 'Token') => {
  const tokenParser = parser(publicKey);
  return (req, res, next) => middleware(req, res, next, tokenParser, headerName);
};

module.exports = {
  extractParts,
  parser,
  sign,
  tokenData
};
