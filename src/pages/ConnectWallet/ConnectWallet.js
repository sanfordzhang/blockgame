import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2'
import globalContext from './../../context/global/globalContext'
import LoadingScreen from '../../components/loading/LoadingScreen'

import socketContext from '../../context/websocket/socketContext'
import { CS_FETCH_LOBBY_INFO } from '../../pokergame/actions'
import './ConnectWallet.scss'

const ConnectWallet = () => {
  const { setWalletAddress, setChipsAmount } = useContext(globalContext)

  const { socket } = useContext(socketContext)
  const navigate = useNavigate()
  const useQuery = () => new URLSearchParams(useLocation().search);
  let query = useQuery()

  const [missingParams, setMissingParams] = useState(false)

  useEffect(() => {
    const walletAddress = query.get('walletAddress')
    const gameId = query.get('gameId')
    const username = query.get('username')

    if (!walletAddress || !gameId || !username) {
      setMissingParams(true)
      return
    }

    if(socket !== null && socket.connected === true){
      console.log(username)
      setWalletAddress(walletAddress)
      socket.emit(CS_FETCH_LOBBY_INFO, { walletAddress, socketId: socket.id, gameId, username })
      console.log(CS_FETCH_LOBBY_INFO, { walletAddress, socketId: socket.id, gameId, username })
      navigate('/play')
    }
  }, [socket])

  if (missingParams) {
    return (
      <div className="connect-wallet-error">
        <h2>缺少必要参数</h2>
        <p>请通过正确的链接访问游戏，URL 需要包含以下参数：</p>
        <ul>
          <li><code>walletAddress</code> - 钱包地址</li>
          <li><code>gameId</code> - 游戏ID</li>
          <li><code>username</code> - 用户名</li>
        </ul>
        <p>示例：<code>?walletAddress=0x123...&gameId=1&username=player1</code></p>
      </div>
    )
  }

  return (
    <>
      <LoadingScreen />
    </>
  )
}

export default ConnectWallet
