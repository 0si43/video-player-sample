import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  // 保存された動画リストを読み込む
  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const savedVideos = await AsyncStorage.getItem('videoList');
      if (savedVideos) {
        setVideos(JSON.parse(savedVideos));
      }
    } catch (error) {
      console.error('動画リストの読み込みエラー:', error);
    }
  };

  const saveVideos = async (videoList) => {
    try {
      await AsyncStorage.setItem('videoList', JSON.stringify(videoList));
    } catch (error) {
      console.error('動画リストの保存エラー:', error);
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('権限エラー', 'メディアライブラリへのアクセス権限が必要です。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      await saveVideo(result.assets[0]);
    }
  };

  const saveVideo = async (asset) => {
    try {
      const fileName = asset.uri.split('/').pop();
      const newPath = FileSystem.documentDirectory + fileName;
      
      await FileSystem.copyAsync({
        from: asset.uri,
        to: newPath,
      });

      const newVideo = {
        id: Date.now().toString(),
        uri: newPath,
        name: fileName,
        duration: asset.duration || 0,
      };

      const updatedVideos = [...videos, newVideo];
      setVideos(updatedVideos);
      await saveVideos(updatedVideos);
      
      Alert.alert('成功', '動画が保存されました。');
    } catch (error) {
      console.error('動画の保存エラー:', error);
      Alert.alert('エラー', '動画の保存に失敗しました。');
    }
  };

  const deleteVideo = async (videoId) => {
    Alert.alert(
      '削除確認',
      'この動画を削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            const videoToDelete = videos.find(v => v.id === videoId);
            if (videoToDelete) {
              try {
                await FileSystem.deleteAsync(videoToDelete.uri, { idempotent: true });
                const updatedVideos = videos.filter(v => v.id !== videoId);
                setVideos(updatedVideos);
                await saveVideos(updatedVideos);
              } catch (error) {
                console.error('動画の削除エラー:', error);
              }
            }
          },
        },
      ]
    );
  };

  const playPauseVideo = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const rewind = async () => {
    if (videoRef.current && position > 0) {
      const newPosition = Math.max(0, position - 10000); // 10秒戻る
      await videoRef.current.setPositionAsync(newPosition);
      setPosition(newPosition);
    }
  };

  const forward = async () => {
    if (videoRef.current && position < duration) {
      const newPosition = Math.min(duration, position + 10000); // 10秒進む
      await videoRef.current.setPositionAsync(newPosition);
      setPosition(newPosition);
    }
  };

  const onSliderValueChange = async (value) => {
    if (videoRef.current) {
      const newPosition = value * duration;
      await videoRef.current.setPositionAsync(newPosition);
      setPosition(newPosition);
    }
  };

  const formatTime = (millis) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderVideoItem = ({ item }) => (
    <TouchableOpacity
      style={styles.videoItem}
      onPress={() => setSelectedVideo(item)}
      onLongPress={() => deleteVideo(item.id)}
    >
      <Ionicons name="videocam" size={40} color="#007AFF" />
      <Text style={styles.videoName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.videoDuration}>
        {formatTime(item.duration * 1000)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>動画プレイヤー</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={pickVideo}>
          <Ionicons name="add-circle" size={30} color="#007AFF" />
          <Text style={styles.uploadText}>動画を追加</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={renderVideoItem}
        contentContainerStyle={styles.videoList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            動画がありません。上の「動画を追加」から動画をアップロードしてください。
          </Text>
        }
      />

      <Modal
        visible={!!selectedVideo}
        animationType="slide"
        onRequestClose={() => {
          setSelectedVideo(null);
          setIsPlaying(false);
        }}
      >
        {selectedVideo && (
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setSelectedVideo(null);
                setIsPlaying(false);
              }}
            >
              <Ionicons name="close-circle" size={30} color="#fff" />
            </TouchableOpacity>

            <Video
              ref={videoRef}
              style={styles.video}
              source={{ uri: selectedVideo.uri }}
              useNativeControls={false}
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded) {
                  setPosition(status.positionMillis || 0);
                  setDuration(status.durationMillis || 0);
                  setIsPlaying(status.isPlaying || false);
                }
              }}
            />

            <View style={styles.controls}>
              <View style={styles.sliderContainer}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  value={duration > 0 ? position / duration : 0}
                  onSlidingComplete={onSliderValueChange}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#ccc"
                  thumbTintColor="#007AFF"
                />
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity onPress={rewind} style={styles.controlButton}>
                  <Ionicons name="play-back" size={30} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity onPress={playPauseVideo} style={styles.playButton}>
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={40}
                    color="#fff"
                  />
                </TouchableOpacity>

                <TouchableOpacity onPress={forward} style={styles.controlButton}>
                  <Ionicons name="play-forward" size={30} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadText: {
    marginLeft: 5,
    color: '#007AFF',
    fontSize: 16,
  },
  videoList: {
    padding: 10,
  },
  videoItem: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 5,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  videoName: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
  },
  videoDuration: {
    color: '#666',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 1,
  },
  video: {
    width: screenWidth,
    height: screenWidth * 0.6,
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    padding: 20,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    width: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButton: {
    padding: 10,
    marginHorizontal: 20,
  },
  playButton: {
    backgroundColor: '#007AFF',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
  },
});