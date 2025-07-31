import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:io';
import 'dart:typed_data';
import 'dart:convert';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '動画プレイヤー',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: VideoListScreen(),
    );
  }
}

class VideoData {
  final String name;
  final Uint8List? bytes;
  final String? url;

  VideoData({required this.name, this.bytes, this.url});
}

class VideoListScreen extends StatefulWidget {
  const VideoListScreen({super.key});

  @override
  _VideoListScreenState createState() => _VideoListScreenState();
}

class _VideoListScreenState extends State<VideoListScreen> {
  final List<VideoData> _videos = [];

  Future<void> _pickVideo() async {
    FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.video,
      allowMultiple: false,
      withData: kIsWeb,
    );

    if (result != null) {
      if (kIsWeb) {
        final file = result.files.first;
        if (file.bytes != null) {
          setState(() {
            _videos.add(VideoData(
              name: file.name,
              bytes: file.bytes,
            ));
          });
        }
      } else {
        final file = result.files.first;
        if (file.path != null) {
          setState(() {
            _videos.add(VideoData(
              name: file.name,
              url: file.path,
            ));
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('動画一覧'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: _videos.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.video_library, size: 100, color: Colors.grey),
                  SizedBox(height: 20),
                  Text(
                    '動画がありません\n右下のボタンから追加してください',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 16),
                  ),
                ],
              ),
            )
          : GridView.builder(
              padding: EdgeInsets.all(8),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 16 / 9,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: _videos.length,
              itemBuilder: (context, index) {
                return VideoThumbnail(
                  video: _videos[index],
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => VideoPlayerScreen(
                          videoData: _videos[index],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _pickVideo,
        tooltip: '動画を追加',
        child: Icon(Icons.add),
      ),
    );
  }
}

class VideoThumbnail extends StatelessWidget {
  final VideoData video;
  final VoidCallback onTap;

  const VideoThumbnail({super.key, required this.video, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.grey[300],
          borderRadius: BorderRadius.circular(8),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Icon(Icons.video_library, size: 50, color: Colors.grey[600]),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(8),
                    bottomRight: Radius.circular(8),
                  ),
                ),
                child: Text(
                  video.name,
                  style: TextStyle(color: Colors.white, fontSize: 12),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class VideoPlayerScreen extends StatefulWidget {
  final VideoData videoData;

  const VideoPlayerScreen({super.key, required this.videoData});

  @override
  _VideoPlayerScreenState createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen> {
  VideoPlayerController? _controller;
  bool _isPlaying = false;
  bool _isInitialized = false;
  bool _showControls = true;
  bool _showSeekIndicator = false;
  String _seekIndicatorText = '';

  @override
  void initState() {
    super.initState();
    _initializeVideo();
  }

  Future<void> _initializeVideo() async {
    try {
      if (kIsWeb && widget.videoData.bytes != null) {
        // Web環境：Base64エンコードしてdata URIを作成
        final base64String = base64Encode(widget.videoData.bytes!);
        final mimeType = _getMimeType(widget.videoData.name);
        final dataUri = Uri.parse('data:$mimeType;base64,$base64String');
        
        _controller = VideoPlayerController.networkUrl(dataUri);
      } else if (!kIsWeb && widget.videoData.url != null) {
        // モバイル環境：ファイルパスからの再生
        _controller = VideoPlayerController.file(File(widget.videoData.url!));
      }

      if (_controller != null) {
        await _controller!.initialize();
        setState(() {
          _isInitialized = true;
        });

        _controller!.addListener(() {
          final isPlaying = _controller!.value.isPlaying;
          if (isPlaying != _isPlaying) {
            setState(() {
              _isPlaying = isPlaying;
            });
          }
        });
      }
    } catch (e) {
      print('動画の初期化エラー: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('動画の読み込みに失敗しました')),
      );
    }
  }

  String _getMimeType(String fileName) {
    final extension = fileName.split('.').last.toLowerCase();
    switch (extension) {
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'avi':
        return 'video/x-msvideo';
      case 'webm':
        return 'video/webm';
      case 'm4v':
        return 'video/x-m4v';
      default:
        return 'video/mp4';
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, '0');
    final minutes = twoDigits(duration.inMinutes);
    final seconds = twoDigits(duration.inSeconds.remainder(60));
    return '$minutes:$seconds';
  }

  void _rewind() {
    if (_controller != null) {
      final currentPosition = _controller!.value.position;
      final newPosition = currentPosition - Duration(seconds: 10);
      _controller!.seekTo(newPosition >= Duration.zero ? newPosition : Duration.zero);
      _showSeekFeedback('-10秒');
    }
  }

  void _fastForward() {
    if (_controller != null) {
      final currentPosition = _controller!.value.position;
      final duration = _controller!.value.duration;
      final newPosition = currentPosition + Duration(seconds: 10);
      _controller!.seekTo(newPosition <= duration ? newPosition : duration);
      _showSeekFeedback('+10秒');
    }
  }

  void _showSeekFeedback(String text) {
    setState(() {
      _seekIndicatorText = text;
      _showSeekIndicator = true;
    });
    
    Future.delayed(Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() {
          _showSeekIndicator = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: Colors.white),
      ),
      body: Center(
        child: _isInitialized && _controller != null
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      AspectRatio(
                        aspectRatio: _controller!.value.aspectRatio,
                        child: Stack(
                          children: [
                            VideoPlayer(_controller!),
                            // タップ領域を追加
                            Row(
                              children: [
                                // 左側タップエリア（巻き戻し）
                                Expanded(
                                  child: GestureDetector(
                                    onDoubleTap: _rewind,
                                    behavior: HitTestBehavior.translucent,
                                    child: Container(
                                      color: Colors.transparent,
                                    ),
                                  ),
                                ),
                                // 中央タップエリア（再生/一時停止）
                                Expanded(
                                  child: GestureDetector(
                                    onTap: () {
                                      setState(() {
                                        _isPlaying ? _controller!.pause() : _controller!.play();
                                      });
                                    },
                                    behavior: HitTestBehavior.translucent,
                                    child: Container(
                                      color: Colors.transparent,
                                    ),
                                  ),
                                ),
                                // 右側タップエリア（早送り）
                                Expanded(
                                  child: GestureDetector(
                                    onDoubleTap: _fastForward,
                                    behavior: HitTestBehavior.translucent,
                                    child: Container(
                                      color: Colors.transparent,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            // シークインジケーター
                            if (_showSeekIndicator)
                              Center(
                                child: Container(
                                  padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: Colors.black54,
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    _seekIndicatorText,
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 20),
                  // コントロールバー
                  AnimatedOpacity(
                    opacity: _showControls ? 1.0 : 0.0,
                    duration: Duration(milliseconds: 300),
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Text(
                                _formatDuration(_controller!.value.position),
                                style: TextStyle(color: Colors.white),
                              ),
                              Expanded(
                                child: Slider(
                                  value: _controller!.value.position.inSeconds.toDouble(),
                                  min: 0.0,
                                  max: _controller!.value.duration.inSeconds.toDouble(),
                                  onChanged: (value) {
                                    _controller!.seekTo(Duration(seconds: value.toInt()));
                                  },
                                ),
                              ),
                              Text(
                                _formatDuration(_controller!.value.duration),
                                style: TextStyle(color: Colors.white),
                              ),
                            ],
                          ),
                          SizedBox(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              IconButton(
                                icon: Icon(Icons.replay_10),
                                color: Colors.white,
                                iconSize: 40,
                                onPressed: _rewind,
                              ),
                              SizedBox(width: 20),
                              IconButton(
                                icon: Icon(
                                  _isPlaying ? Icons.pause : Icons.play_arrow,
                                ),
                                color: Colors.white,
                                iconSize: 60,
                                onPressed: () {
                                  setState(() {
                                    _isPlaying ? _controller!.pause() : _controller!.play();
                                  });
                                },
                              ),
                              SizedBox(width: 20),
                              IconButton(
                                icon: Icon(Icons.forward_10),
                                color: Colors.white,
                                iconSize: 40,
                                onPressed: _fastForward,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              )
            : CircularProgressIndicator(color: Colors.white),
      ),
    );
  }
}