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
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    let walletAddress = query.get('walletAddress')
    const gameId = query.get('gameId') || '1'
    let username = query.get('username')

    // 如果没有参数，生成默认值或从 localStorage 读取
    if (!walletAddress) {
      // 检查 localStorage
      const savedWallet = localStorage.getItem('game_walletAddress')
      const savedUsername = localStorage.getItem('game_username')

      if (savedWallet && savedUsername) {
        walletAddress = savedWallet
        username = savedUsername
      } else {
        // 生成新的随机值
        walletAddress = '0x' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        username = `player_${Math.floor(Math.random() * 10000)}`
      }
    }

    // 保存到 localStorage
    localStorage.setItem('game_walletAddress', walletAddress)
    localStorage.setItem('game_username', username)

    if(socket !== null && socket.connected === true && !connecting){
      setConnecting(true)
      console.log('Connecting with:', { walletAddress, gameId, username })
      setWalletAddress(walletAddress)
      socket.emit(CS_FETCH_LOBBY_INFO, { walletAddress, socketId: socket.id, gameId, username })
      console.log(CS_FETCH_LOBBY_INFO, { walletAddress, socketId: socket.id, gameId, username })
      navigate('/play')
    }
  }, [socket])

  if (missingParams) {
    return (
      <div className="connect-wallet-error">
        <h2>连接失败</h2>
        <p>正在尝试连接游戏服务器...</p>
        <LoadingScreen />
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
