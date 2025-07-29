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
    const videoList = [{ id: '1', title: '動画1' }];

    await saveVideos(videoList);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'videoList',
      JSON.stringify(videoList)
    );
  });

  it('Web環境で動画リストを保存する', async () => {
    Platform.OS = 'web';
    const videoList = [{ id: '1', title: '動画1' }];

    await saveVideos(videoList);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'videoList',
      JSON.stringify(videoList)
    );
  });
});