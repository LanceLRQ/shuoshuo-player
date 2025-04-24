const path = require('path');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const chalk = require("chalk");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CracoLessPlugin = require('craco-less');
const { loaderByName } = require("@craco/craco");
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
const isDev = process.env.NODE_ENV === 'development';
module.exports = {
    eslint: {
        enable: false,
    },
    plugins: [
        {
            plugin: CracoLessPlugin,
            options: {
                lessLoaderOptions: {
                    lessOptions: {
                        modifyVars: {
                            '@primary-color': '#1890ff',
                        },
                        javascriptEnabled: true,
                    }
                },
            },
        },
    ],
    webpack: {
        configure: (webpackConfig) => {
            webpackConfig.resolve.symlinks = false;
            webpackConfig.entry = {
                main: path.resolve(__dirname, './src/index.js'),
                player: path.resolve(__dirname, './src/player/index.js'),
                background: path.resolve(__dirname, './src/background/index.js'),
            }
            webpackConfig.plugins.forEach((plugin) => {
                if (plugin.constructor.name === 'HtmlWebpackPlugin') {
                    plugin.options.excludeChunks = ['player', 'background'];
                }
            })
            webpackConfig.output = {
                ...webpackConfig.output,
                filename: (pathData) => {
                    if (pathData.chunk.name === 'background') {
                        return 'background.js';
                    }
                    return 'js/[name].bundle.js';
                },
                publicPath: isDev ? '/' : './'
            }
            webpackConfig.plugins.push(
                new HtmlWebpackPlugin({
                    inject: true,
                    template: path.resolve(__dirname, './public/player.html'),
                    chunks: ['player'],
                    excludeChunks: ['background'],
                    filename: 'player.html',
                    templateParameters: {
                        PLAYER_NAME: process.env.PLAYER_NAME || '说说Crystal播放器',
                        PLAYER_VERSION: process.env.PLAYER_VERSION || '开发版',
                    }
                }),
                new ProgressBarPlugin({
                    complete: "█",
                    format: `${chalk.green('Building')} [ ${chalk.green(':bar')} ] ${chalk.bold(':percent')}`,
                    clear: false
                })
            )
            webpackConfig.plugins.push(new LodashModuleReplacementPlugin())
            return webpackConfig
        },
        alias: {
            "@": path.resolve(__dirname, "src"),
            "@styles": path.resolve(__dirname, "src/styles"),
            "@player": path.resolve(__dirname, "src/player"),
        },
    },
    devServer: {
        devMiddleware: {
            writeToDisk: (filePath) => {
                return !/\.hot-update(.*)$/.test(filePath);
            },
        },
        watchFiles: {
            options: {
                ignored: /src\/background\/index\.js/
            },
        },
    },
}
