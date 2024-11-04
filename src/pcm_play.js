(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
    ? define(factory)
    : ((global = global || self), (global.PCMPlayer = factory()));
})(this, function () {
  'use strict';

  class PCMPlayer {
    constructor(option) {
      this.init(option);
    }

    init(option) {
      const defaultOption = {
        inputCodec: 'Int16', // 传入的数据是采用多少位编码，默认16位
        channels: 1, // 声道数
        sampleRate: 8000, // 采样率 单位Hz
        flushTime: 1000, // 缓存时间 单位 ms
        fftSize: 2048, // analyserNode fftSize
      };

      this.option = Object.assign({}, defaultOption, option); // 实例最终配置参数
      this.samples = new Float32Array(); // 样本存放区域
      this.interval = setInterval(this.flush.bind(this), this.option.flushTime);
      this.convertValue = this.getConvertValue();
      this.typedArray = this.getTypedArray();
      this.initAudioContext();
      this.bindAudioContextEvent();
      this.onPlaybackEndCallback = null;
      this.fileName = 'pcmAudio.pcm';
      this.samplesAll = [];
    }

    getConvertValue() {
      // 根据传入的目标编码位数
      // 选定转换数据所需要的基本值
      const inputCodecs = {
        Int8: 128,
        Int16: 32768,
        Int32: 2147483648,
        Float32: 1,
      };
      if (!inputCodecs[this.option.inputCodec])
        throw new Error(
          'wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32',
        );
      return inputCodecs[this.option.inputCodec];
    }

    getTypedArray() {
      // 根据传入的目标编码位数
      // 选定前端的所需要的保存的二进制数据格式
      // 完整TypedArray请看文档
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray
      const typedArrays = {
        Int8: Int8Array,
        Int16: Int16Array,
        Int32: Int32Array,
        Float32: Float32Array,
      };
      if (!typedArrays[this.option.inputCodec])
        throw new Error(
          'wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32',
        );
      return typedArrays[this.option.inputCodec];
    }

    initAudioContext() {
      // 初始化音频上下文的东西
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // 控制音量的 GainNode
      // https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createGain
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 0.1;
      this.gainNode.connect(this.audioCtx.destination);
      this.startTime = this.audioCtx.currentTime;
      this.destination = 0;
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = this.option.fftSize;
    }

    static isTypedArray(data) {
      // 检测输入的数据是否为 TypedArray 类型或 ArrayBuffer 类型
      return (
        (data.byteLength &&
          data.buffer &&
          data.buffer.constructor == ArrayBuffer) ||
        data.constructor == ArrayBuffer
      );
    }

    isSupported(data) {
      // 数据类型是否支持
      // 目前支持 ArrayBuffer 或者 TypedArray
      if (!PCMPlayer.isTypedArray(data))
        throw new Error('请传入ArrayBuffer或者任意TypedArray');
      return true;
    }

    feed(data, onPlaybackEnd) {
      this.isSupported(data);

      // 检查音频上下文状态，如果暂停则恢复
      if (this.audioCtx.state === 'suspended') {
        this.samples = new Float32Array();
        this.audioCtx.resume().then(() => {
          this.feed(data, onPlaybackEnd);
        });
        return;
      }

      // 获取格式化后的buffer
      data = this.getFormattedValue(data);
      // 开始拷贝buffer数据
      // 新建一个Float32Array的空间
      const tmp = new Float32Array(this.samples.length + data.length);
      // 复制当前的实例的buffer值（历史buff)
      // 从头（0）开始复制
      tmp.set(this.samples, 0);
      // 复制传入的新数据
      // 从历史buff位置开始
      tmp.set(data, this.samples.length);
      // 将新的完整buff数据赋值给samples
      // interval定时器也会从samples里面播放数据
      this.samples = tmp;
      this.flushing = true;
      this.onPlaybackEndCallback = onPlaybackEnd;
      // this.flush();
    }

    //播放并下载
    downFile(data, fileName) {
      this.isSupported(data);

      // 检查音频上下文状态，如果暂停则恢复
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().then(() => {
          this.downFile(data, fileName);
        });
        return;
      }

      this.samplesAll.push(data);
      this.fileName = fileName;
      // 获取格式化后的buffer
      data = this.getFormattedValue(data);

      // 开始拷贝buffer数据
      // 新建一个Float32Array的空间
      const tmp = new Float32Array(this.samples.length + data.length);
      // 复制当前的实例的buffer值（历史buff)
      // 从头（0）开始复制
      tmp.set(this.samples, 0);
      // 复制传入的新数据
      // 从历史buff位置开始
      tmp.set(data, this.samples.length);
      // 将新的完整buff数据赋值给samples
      // interval定时器也会从samples里面播放数据
      this.samples = tmp;
      this.flushing = true;
      this.onPlaybackEndCallback = this.exportPCMFile;
      // this.flush();
    }

    mergeUint8Arrays(arrays) {
      // 计算总长度
      let totalLength = 0;
      for (const array of arrays) {
        totalLength += array.length;
      }

      // 创建新的 Uint8Array
      const result = new Uint8Array(totalLength);

      // 计数器，用于跟踪结果数组中的当前位置
      let offset = 0;

      // 将所有 Uint8Array 的数据复制到结果数组中
      for (const array of arrays) {
        result.set(array, offset);
        offset += array.length;
      }
      return result;
    }
    exportPCMFile() {
      // 检查是否支持Blob和URL.createObjectURL
      if (!window.Blob || !window.URL.createObjectURL) {
        throw new Error(
          'Your browser does not support Blob or URL.createObjectURL',
        );
      }

      // 创建一个新的Blob对象，使用当前samples中的数据
      const samplesData = this.mergeUint8Arrays(this.samplesAll);
      const blob = new Blob([samplesData], {
        type: 'application/octet-stream',
      });

      // 创建一个URL表示这个Blob对象
      const url = URL.createObjectURL(blob);

      // 创建一个隐藏的a标签用于触发下载
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = this.fileName;

      // 将a标签添加到DOM中并触发click事件
      document.body.appendChild(a);
      a.click();

      // 清理工作
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    getFormattedValue(data) {
      if (data.constructor == ArrayBuffer) {
        data = new this.typedArray(data);
      } else {
        data = new this.typedArray(data.buffer);
      }

      let float32 = new Float32Array(data.length);

      for (let i = 0; i < data.length; i++) {
        // buffer 缓冲区的数据，需要是IEEE754 里32位的线性PCM，范围从-1到+1
        // 所以对数据进行除法
        // 除以对应的位数范围，得到-1到+1的数据
        // float32[i] = data[i] / 0x8000;
        float32[i] = data[i] / this.convertValue;
      }
      return float32;
    }

    volume(volume) {
      this.gainNode.gain.value = volume;
    }

    destroy() {
      if (this.interval) {
        clearInterval(this.interval);
      }
      this.samples = null;
      this.audioCtx.close();
      this.audioCtx = null;
    }

    flush() {
      // 添加一个检查，如果正在播放并且播放结束时调用回调
      if (this.flushing && !this.samples.length) {
        this.flushing = false;
        if (typeof this.onPlaybackEndCallback === 'function') {
          console.log(this.destination, '持续时间====>秒');
          setTimeout(
            () => {
              if (this.onPlaybackEndCallback) {
                this.onPlaybackEndCallback();
                this.onPlaybackEndCallback = null;
              }
              this.fileName = [];
              this.samplesAll = [];
            },
            this.destination ? this.destination * 1000 : 0,
          );
        }
      }

      if (!this.samples.length) {
        this.destination = 0;
        return;
      }

      const self = this;
      var bufferSource = this.audioCtx.createBufferSource();
      if (typeof this.option.onended === 'function') {
        bufferSource.onended = function (event) {
          self.option.onended(this, event);
        };
      }
      const length = this.samples.length / this.option.channels;
      const audioBuffer = this.audioCtx.createBuffer(
        this.option.channels,
        length,
        this.option.sampleRate,
      );

      for (let channel = 0; channel < this.option.channels; channel++) {
        const audioData = audioBuffer.getChannelData(channel);
        let offset = channel;
        let decrement = 50;
        for (let i = 0; i < length; i++) {
          audioData[i] = this.samples[offset];
          /* fadein */
          if (i < 50) {
            audioData[i] = (audioData[i] * i) / 50;
          }
          /* fadeout*/
          if (i >= length - 51) {
            audioData[i] = (audioData[i] * decrement--) / 50;
          }
          offset += this.option.channels;
        }
      }

      if (this.startTime < this.audioCtx.currentTime) {
        this.startTime = this.audioCtx.currentTime;
      }
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(this.gainNode);
      bufferSource.connect(this.analyserNode); // bufferSource连接到analyser
      bufferSource.start(this.startTime);
      this.startTime += audioBuffer.duration;
      this.destination += audioBuffer.duration;
      this.samples = new Float32Array();
    }

    async pause() {
      await this.audioCtx.suspend();
    }

    async continue() {
      await this.audioCtx.resume();
    }

    bindAudioContextEvent() {
      const self = this;
      if (typeof self.option.onstatechange === 'function') {
        this.audioCtx.onstatechange = function (event) {
          self.audioCtx &&
            self.option.onstatechange(this, event, self.audioCtx.state);
        };
      }
    }

    stopAndClear() {
      this.audioCtx.close();
      // 取消定时器
      if (this.interval) {
        clearInterval(this.interval);
      }

      // 清除缓存
      this.samples = new Float32Array();
      this.samplesAll = [];
      // 重置播放状态
      this.flushing = false;
      this.destination = 0;

      // 重新设置定时器
      this.interval = setInterval(this.flush.bind(this), this.option.flushTime);
      // 初始化音频上下文
      this.initAudioContext();
    }
  }

  return PCMPlayer;
});
