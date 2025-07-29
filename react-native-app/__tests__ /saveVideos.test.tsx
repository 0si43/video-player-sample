import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { saveVideos } from '../util/saveVideos';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
}));

const localStorageMock = {
  setItem: jest.fn(),
};
global.localStorage = localStorageMock;

describe('saveVideos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('モバイル環境で動画リストを保存する', async () => {
    Platform.OS = 'ios';
    const videoList = [
      {
        id: '1640995200000',
        uri: 'file:///data/user/0/com.app/files/video_1640995200000.mp4',
        name: 'video_1640995200000.mp4',
        duration: 120.5,
      },
      {
        id: '1640995300000',
        uri: 'file:///data/user/0/com.app/files/sample_video.mp4',
        name: 'sample_video.mp4',
        duration: 45.3,
      },
    ];

    await saveVideos(videoList);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'videoList',
      JSON.stringify(videoList)
    );
  });

  it('Web環境で動画リストを保存する', async () => {
    Platform.OS = 'web';
    const videoList = [
      {
        id: '1640995200000',
        uri: 'blob:http://localhost:3000/550e8400-e29b-41d4-a716-446655440000',
        name: 'recording_2024_01_01.mp4',
        duration: 60.0,
        webUri: 'blob:http://localhost:3000/550e8400-e29b-41d4-a716-446655440000',
      },
    ];

    await saveVideos(videoList);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'videoList',
      JSON.stringify(videoList)
    );
  });
});