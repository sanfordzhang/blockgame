import axios from 'axios';
import { toast } from 'react-toastify';

// Safe access to environment variables
const getEnvVar = (name, defaultValue = '') => {
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return defaultValue;
};

const SERVER_URI = getEnvVar('REACT_APP_SERVER_URI')
  || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${getEnvVar('REACT_APP_SERVER_PORT', '7778')}`;

export const useApi = () => {
  const getUserProfile = async (address) => {
    try {
      const { data } = await axios.post(`${SERVER_URI}/get_profile`, {
        address: address
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      });
      if (data.success) {
        console.log('success', data)
        return data
      } else {
        console.log('error', data)
        return null;
      }
    } catch (err) {
      toast.error(err.message)
      console.log(err)
    }
  }

  const getPokerTables = async (gameId) => {
    try {
      const { data } = await axios.post(`${SERVER_URI}/get_poker_tables`, {
        gameId: gameId
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      });
      if (data.success) {
        return data.result
      } else {
        toast.error('Failed to load all games.')
        return null;
      }
    } catch (err) {
      toast.error(err.message)
      console.log(err)
    }
  }

  const getGameById = async (gameId) => {
    try {
      const { data } = await axios.post(`${SERVER_URI}/get_game_by_id`, {
        gameId: gameId
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      });
      if (data.success) {
        return data.result
      } else {
        toast.error('Failed to load all games.')
        return null;
      }
    } catch (err) {
      toast.error(err.message)
      console.log(err)
    }
  }


  return {
    getUserProfile,
    getPokerTables,
    getGameById,
  }
}