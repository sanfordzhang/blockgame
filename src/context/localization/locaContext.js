import { createContext } from 'react';

const locaContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export default locaContext;
