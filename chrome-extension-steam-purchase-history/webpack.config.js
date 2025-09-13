const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    popup: path.resolve(__dirname, 'popup.js'),
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true,
  },
  mode: 'production',
  devtool: false, // avoid eval for MV3 CSP
  resolve: {
    extensions: ['.js'],
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      util: require.resolve('util/'),
      assert: require.resolve('assert/'),
      vm: require.resolve('vm-browserify'),
      http: false,
      https: false,
      os: require.resolve('os-browserify/browser'),
      path: require.resolve('path-browserify'),
      url: require.resolve('url/'),
      fs: false,
      net: false,
      tls: false,
      zlib: false,
      'child_process': false,
      'worker_threads': false,
      'jsdom': false,
      'canvas': false,
      're2': false,
      'koffi': false,
    },
    alias: {
      'process/browser': require.resolve('process/browser.js'),
      koffi: false,
      re2: false,
      jsdom: false,
      canvas: false,
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules\/core-js/,
        use: [],
      },
    ],
  },
  optimization: {
    minimize: true,
  },
};
