## PCMPlayer

A minimalist javascript audio player for PCM streaming data for the browsers.  
浏览器端简单的 PCM 数据流播放器,支持监听动态音频数据状态。

## How to use?（使用说明）

    var player = new PCMPlayer(options);

Available options are:  
可配置项如下:

| Name       |           Parameter            | Default |   Type |                                                                               Remark |
| ---------- | :----------------------------: | ------: | -----: | -----------------------------------------------------------------------------------: |
| inputCodec | Int8 / Int16 / Int32 / Float32 |   Int16 | string |                                                                             编码格式 |
| channels   |                                |       1 | number |                                                                               声道数 |
| sampleRate |                                |    8000 | number |                                                                               采样率 |
| flushTime  |                                |    1000 | number | flushing interval of PCM data to be played in milisecond（PCM 数据缓冲多久进行播放） |
| fftSize    |                                |    2048 | number |                                                    a power of 2 between 2^5 and 2^15 |

## Complete example（使用示例）:

### Install（安装）

install by CDN or npm

**CDN**

```html
<script src="https://unpkg.com/pcm_player_js"></script>
```

**ES6**

```bash
npm i pcm_player_js
```

```javascript
// in your js/ts file
import PCMPlayer from "pcm_player_js";
```

### use（使用）

```javascript
var player = new PCMPlayer({
  inputCodec: "Int16",
  channels: 2,
  sampleRate: 8000,
  flushTime: 2000,
});

// Now feed PCM data into player getting from websocket or ajax whatever the transport you are using.Accept ArrayBuffer or TypedArray
// 接收PCM格式的原始数据，ArrayBuffer 类型或者 TypedArray 类型
player.feed(pcm_data, () => {
  //播放结束
});
```

## Available Methods（方法）

| Name     |        Parameter         |                                                Remark |
| -------- | :----------------------: | ----------------------------------------------------: |
| feed     |       raw PCM data,()=> :viod      |                    playing PCM data and end callback |
| volume   | decimal value 0 to +∞ () |    For controlling volume of the player, default is 1 |
| destroy  |            -             | Destroy the player instance and release the resources |
| pause    |            -             |                                         pause playing |
| continue |            -             |                                        resume playing |

## Available Attributes（属性）

| Name         |                    Remark |
| ------------ | ------------------------: |
| audioCtx     |      current AudioContext |
| gainNode     |     AudioContext gainNode |
| analyserNode | AudioContext AnalyserNode |

## Available Event（事件）

| Name          | Parameter           | Remark                                                    |
| ------------- | ------------------- | --------------------------------------------------------- |
| onstatechange | (node, event, type) | node: AudioContext, event: Event, type: AudioContextState |
| onended       | (node, event)       | node: AudioBufferSourceNode, event: Event                 |

## Thoubleshooting（常见问题）

Safari only allow to play large than 22050Hz voice.  
Safari 浏览器播放的音频数据，采样率不能低于 22050Hz。