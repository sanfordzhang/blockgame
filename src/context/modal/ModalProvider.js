import React, { useState, useEffect, useCallback } from 'react';
import ModalContext from './modalContext';
import Modal, { initialModalData } from '../../components/modals/Modal';

const ModalProvider = ({ children }) => {
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(initialModalData);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const layoutWrapper = document.getElementById('layout-wrapper');

    if (showModal) {
      document.body.style.overflow = 'hidden';

      if (layoutWrapper) {
        layoutWrapper.style.filter = 'blur(4px)';
        layoutWrapper.style.pointerEvents = 'none';
        layoutWrapper.tabIndex = '-1';
      }
    } else {
      document.body.style.overflow = 'initial';

      if (layoutWrapper) {
        layoutWrapper.style.filter = 'none';
        layoutWrapper.style.pointerEvents = 'all';
      }
    }
  }, [showModal]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setIsLoading(false);
  }, []);

  const openModal = useCallback((
    children,
    headingText,
    btnText,
    btnCallBack = closeModal,
    onCloseCallBack = closeModal,
  ) => {
    setModalData({
      children,
      headingText,
      btnText,
      btnCallBack,
      onCloseCallBack,
    });

    setShowModal(true);
  }, [closeModal]);

  // 处理按钮点击，支持async回调
  const handleBtnClick = useCallback(async () => {
    if (modalData.btnCallBack) {
      setIsLoading(true);
      try {
        await Promise.resolve(modalData.btnCallBack());
        // 成功后关闭弹窗
        closeModal();
      } catch (error) {
        console.error('[Modal] Button callback error:', error);
        setIsLoading(false);
        // 不关闭弹窗，让用户看到错误
      }
    } else {
      closeModal();
    }
  }, [modalData.btnCallBack, closeModal]);

  return (
    <ModalContext.Provider
      value={{ showModal, modalData, openModal, closeModal, isLoading }}
    >
      {children}
      {showModal && (
        <Modal
          headingText={modalData.headingText}
          btnText={isLoading ? 'Processing...' : modalData.btnText}
          onClose={modalData.onCloseCallBack}
          onBtnClicked={handleBtnClick}
          isLoading={isLoading}
        >
          {modalData.children()}
        </Modal>
      )}
    </ModalContext.Provider>
  );
};

export default ModalProvider;
