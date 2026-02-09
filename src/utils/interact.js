import { ethers } from 'ethers'

export const connectMetamask = async () => {
  if (window.ethereum) {
    try {
      const addressArr = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      return { event: 'connected', response: addressArr[0] }
    } catch (err) {
      console.log(err.message)
      return { event: 'error', response: err.message }
    }
  } else {
    console.log('plz install metamask on your browser')
    return { event: 'No Wallet', response: 'plz install metamask on your browser'}
  }
}
