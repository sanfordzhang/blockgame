import styled from 'styled-components';

export const UIWrapper = styled.div`
  position: fixed;
  bottom: 2vh;
  left: 50%;
  transform: translateX(-50%);
  transform-origin: bottom center;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  max-width: 90vw;
  width: auto;

  @media screen and (max-width: 1200px) {
    transform: translateX(-50%) scale(0.85);
  }

  @media screen and (max-width: 1068px) {
    transform: translateX(-50%) scale(0.8);
  }

  @media screen and (max-width: 968px) {
    transform: translateX(-50%) scale(0.75);
  }

  @media screen and (max-width: 868px) {
    transform: translateX(-50%) scale(0.7);
  }

  @media screen and (max-width: 812px) {
    transform: translateX(-50%) scale(0.65);
  }

  @media screen and (max-width: 668px) {
    transform: translateX(-50%) scale(0.6);
  }

  @media screen and (max-width: 648px) {
    transform: translateX(-50%) scale(0.55);
  }

  @media screen and (max-width: 568px) {
    transform: translateX(-50%) scale(0.5);
  }
`;
