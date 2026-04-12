import React, { useContext } from 'react';
import styled from 'styled-components';
import locaContext from '../../context/localization/locaContext';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.8rem;
  margin: 0 0.25rem;
`;

const LangBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 5px;
  border-radius: 3px;
  font-weight: ${(p) => (p.active ? '700' : '400')};
  color: ${(p) =>
    p.active ? p.theme.colors.primaryCta : p.theme.colors.textSecondary};
  transition: all 0.15s;

  &:hover {
    color: ${(p) => p.theme.colors.primaryCta};
  }
`;

const Divider = styled.span`
  color: ${(p) => p.theme.colors.textSecondary};
  opacity: 0.5;
  user-select: none;
`;

const LangSwitcher = () => {
  const { lang, setLang } = useContext(locaContext);

  return (
    <Wrapper>
      <LangBtn active={lang === 'en'} onClick={() => setLang('en')}>
        EN
      </LangBtn>
      <Divider>|</Divider>
      <LangBtn active={lang === 'zh'} onClick={() => setLang('zh')}>
        中
      </LangBtn>
    </Wrapper>
  );
};

export default LangSwitcher;
