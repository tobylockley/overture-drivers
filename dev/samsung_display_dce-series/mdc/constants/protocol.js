const MSG_HEADER = 0xAA
const GET_DATA = 0x00
const SET_DATA = 0x01
const ACK = 0x41;
const NAK = 0x4E;

const ERROR_CHECKSUM = 0x00;
const ERROR_ETC = 0x01;

const ERRORS = {};
ERRORS[ERROR_CHECKSUM.toString(16)] = "Checksum Error";
ERRORS[ERROR_ETC.toString(16)] = "General Error";

module.exports = {
  MSG_HEADER,
  GET_DATA,
  SET_DATA,
  ACK,
  NAK,
  ERROR_CHECKSUM,
  ERROR_ETC,
  ERRORS
}