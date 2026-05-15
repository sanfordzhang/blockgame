import { getServerBaseUrl, getSocketBaseUrl } from './utils/serverConfig';

// Safe access to environment variables
const getEnvVar = (name, defaultValue = '') => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return defaultValue;
};

const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';

const config = {
  isProduction: isProd,
  contentfulSpaceId: getEnvVar('REACT_APP_CONTENTFUL_SPACE_ID', ''),
  contentfulAccessToken: getEnvVar('REACT_APP_CONTENTFUL_ACCESS_TOKEN', ''),
  serverUrl: getServerBaseUrl(),
  socketURI: getSocketBaseUrl(),
};

export default config;
