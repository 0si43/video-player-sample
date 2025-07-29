import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { saveVideos } from '../../util/saveVideos';

const { width: screenWidth } = Dimensions.get('window');

export default function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  // ダブルタップ関連の状態
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showLeftSeek, setShowLeftSeek] = useState(false);
  const [showRightSeek, setShowRightSeek] = useState(false);
  const leftSeekOpacity = useRef(new Animated.Value(0)).current;
  const rightSeekOpacity = useRef(new Animated.Value(0)).current;

  // 保存された動画リストを読み込む
  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web環境ではlocalStorageを使用
        const savedVideos = localStorage.getItem('videoList');
        if (savedVideos) {
          setVideos(JSON.parse(savedVideos));
        }
      } else {
        // ネイティブ環境ではAsyncStorageを使用
        const savedVideos = await AsyncStorage.getItem('videoList');
        if (savedVideos) {
          setVideos(JSON.parse(savedVideos));
        }
      }
    } catch (error) {
      console.error('動画リストの読み込みエラー:', error);
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
      let videoUri = asset.uri;
      let fileName = asset.uri.split('/').pop();
      
      // Web環境の場合は別処理
      if (Platform.OS === 'web') {
        // Web環境では直接URIを使用
        const newVideo = {
          id: Date.now().toString(),
          uri: asset.uri,
          name: fileName || `video_${Date.now()}.mp4`,
          duration: asset.duration || 0,
          // Web用にblob URLを保存
          webUri: asset.uri,
        };

        const updatedVideos = [...videos, newVideo];
        setVideos(updatedVideos);
        
        // Web環境でもlocalStorageを使用して永続化
        try {
          localStorage.setItem('videoList', JSON.stringify(updatedVideos));
        } catch (e) {
          console.log('LocalStorage not available');
        }
        
        Alert.alert('成功', '動画が追加されました。');
      } else {
        // ネイティブ環境（iOS/Android）
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
      }
    } catch (error) {
      console.error('動画の保存エラー:', error);
      Alert.alert('エラー', '動画の保存に失敗しました。');
    }
  };

  const deleteVideo = async (videoId) => {
    const confirmDelete = () => {
      try {
        const videoToDelete = videos.find(v => v.id === videoId);
        if (videoToDelete) {
          // ネイティブ環境でのみファイル削除を実行
          if (Platform.OS !== 'web' && FileSystem.deleteAsync) {
            FileSystem.deleteAsync(videoToDelete.uri, { idempotent: true }).catch(e => 
              console.log('ファイル削除エラー（無視可）:', e)
            );
          }
          
          // 動画リストから削除
          const updatedVideos = videos.filter(v => v.id !== videoId);
          setVideos(updatedVideos);
          
          // ストレージを更新
          if (Platform.OS === 'web') {
            localStorage.setItem('videoList', JSON.stringify(updatedVideos));
            console.log('Video deleted:', videoId);
            console.log('Updated list:', updatedVideos);
          } else {
            AsyncStorage.setItem('videoList', JSON.stringify(updatedVideos));
          }
          
          // 選択中の動画が削除された場合はモーダルを閉じる
          if (selectedVideo && selectedVideo.id === videoId) {
            setSelectedVideo(null);
            setIsPlaying(false);
          }
        }
      } catch (error) {
        console.error('動画の削除エラー:', error);
      }
    };

    if (Platform.OS === 'web') {
      // Web環境では標準のconfirmを使用
      if (window.confirm('この動画を削除しますか？')) {
        confirmDelete();
      }
    } else {
      // ネイティブ環境ではAlert.alertを使用
      Alert.alert(
        '削除確認',
        'この動画を削除しますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '削除',
            style: 'destructive',
            onPress: confirmDelete,
          },
        ]
      );
    }
  };

  const clearAllVideos = async () => {
    const confirmClear = () => {
      try {
        // ネイティブ環境での動画ファイル削除
        if (Platform.OS !== 'web') {
          videos.forEach(video => {
            FileSystem.deleteAsync(video.uri, { idempotent: true }).catch(e =>
              console.log('ファイル削除エラー（無視可）:', e)
            );
          });
        }
        
        // 状態をクリア
        setVideos([]);
        
        // 選択中の動画があればモーダルを閉じる
        if (selectedVideo) {
          setSelectedVideo(null);
          setIsPlaying(false);
        }
        
        // ストレージをクリア
        if (Platform.OS === 'web') {
          localStorage.removeItem('videoList');
          console.log('All videos cleared from localStorage');
        } else {
          AsyncStorage.removeItem('videoList');
        }
      } catch (error) {
        console.error('全削除エラー:', error);
      }
    };

    if (Platform.OS === 'web') {
      // Web環境では標準のconfirmを使用
      if (window.confirm('すべての動画を削除しますか？この操作は取り消せません。')) {
        confirmClear();
      }
    } else {
      // ネイティブ環境ではAlert.alertを使用
      Alert.alert(
        '全削除確認',
        'すべての動画を削除しますか？この操作は取り消せません。',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '全て削除',
            style: 'destructive',
            onPress: confirmClear,
          },
        ]
      );
    }
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

  // ダブルタップハンドラー
  const handleTap = async (event) => {
    const currentTime = Date.now();
    const tapX = event.nativeEvent.locationX;
    const isLeftSide = tapX < screenWidth / 2;

    if (currentTime - lastTapTime < 300) { // ダブルタップと判定（300ms以内）
      if (isLeftSide) {
        // 左側：10秒戻る
        await rewind();
        showSeekAnimation('left');
      } else {
        // 右側：10秒進む
        await forward();
        showSeekAnimation('right');
      }
    }
    setLastTapTime(currentTime);
  };

  // シークアニメーションを表示
  const showSeekAnimation = (side) => {
    const opacity = side === 'left' ? leftSeekOpacity : rightSeekOpacity;
    const setSide = side === 'left' ? setShowLeftSeek : setShowRightSeek;

    setSide(true);
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        delay: 400,
        useNativeDriver: true,
      }),
    ]).start(() => setSide(false));
  };

  const renderVideoItem = ({ item }) => (
    <View style={styles.videoItemContainer}>
      <TouchableOpacity
        style={styles.videoItem}
        onPress={() => setSelectedVideo(item)}
        onLongPress={() => deleteVideo(item.id)}
      >
        <Ionicons name="videocam" size={40} color="#007AFF" />
        <View style={styles.videoInfo}>
          <Text style={styles.videoName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.videoDuration}>
            {formatTime(item.duration * 1000)}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteVideo(item.id)}
      >
        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>動画プレイヤー</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.uploadButton} onPress={pickVideo}>
            <Ionicons name="add-circle" size={30} color="#007AFF" />
            <Text style={styles.uploadText}>動画を追加</Text>
          </TouchableOpacity>
          {videos.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearAllVideos}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              <Text style={styles.clearText}>全削除</Text>
            </TouchableOpacity>
          )}
        </View>
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

            <TouchableWithoutFeedback onPress={handleTap}>
              <View style={styles.videoContainer}>
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

                {/* 左側シークインジケーター */}
                {showLeftSeek && (
                  <Animated.View 
                    style={[
                      styles.seekIndicator, 
                      styles.leftSeekIndicator,
                      { opacity: leftSeekOpacity }
                    ]}
                  >
                    <Ionicons name="play-back" size={40} color="#fff" />
                    <Text style={styles.seekText}>10秒</Text>
                  </Animated.View>
                )}

                {/* 右側シークインジケーター */}
                {showRightSeek && (
                  <Animated.View 
                    style={[
                      styles.seekIndicator, 
                      styles.rightSeekIndicator,
                      { opacity: rightSeekOpacity }
                    ]}
                  >
                    <Ionicons name="play-forward" size={40} color="#fff" />
                    <Text style={styles.seekText}>10秒</Text>
                  </Animated.View>
                )}
              </View>
            </TouchableWithoutFeedback>

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
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
  },
  clearText: {
    marginLeft: 5,
    color: '#FF3B30',
    fontSize: 16,
  },
  videoList: {
    padding: 10,
  },
  videoItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  videoItem: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  videoInfo: {
    flex: 1,
    marginLeft: 15,
  },
  videoName: {
    fontSize: 16,
    marginBottom: 4,
  },
  videoDuration: {
    color: '#666',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#fff',
    padding: 10,
    marginLeft: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  videoContainer: {
    width: screenWidth,
    height: screenWidth * 0.6,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  seekIndicator: {
    position: 'absolute',
    top: '50%',
    marginTop: -60,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 50,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftSeekIndicator: {
    left: 40,
  },
  rightSeekIndicator: {
    right: 40,
  },
  seekText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 5,
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