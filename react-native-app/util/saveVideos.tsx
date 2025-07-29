import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const saveVideos = async (videoList) => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem('videoList', JSON.stringify(videoList));
    } else {
      await AsyncStorage.setItem('videoList', JSON.stringify(videoList));
    }
  } catch (error) {
    console.error('動画リストの保存エラー:', error);
  }
};