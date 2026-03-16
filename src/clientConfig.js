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
  socketURI: isProd
    ? getEnvVar('REACT_APP_SERVER_URI', '')
    : `http://${window.location.hostname}:7777/`,
};

export default config;