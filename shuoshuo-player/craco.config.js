const path = require('path');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const chalk = require("chalk");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const isDev = process.env.NODE_ENV === 'development';
module.exports = {
    eslint: {
        enable: false,
    },
    webpack: {
        configure: (webpackConfig) => {
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
                        return 'js/background.js';
                    }
                    return isDev ? 'js/[name].bundle.js' : 'js/[name].[contenthash:8].js'
                },
            }
            webpackConfig.plugins.push(new HtmlWebpackPlugin({
                inject: true,
                template: path.resolve(__dirname, './public/options.html'),
                chunks: ['player'],
                excludeChunks: ['background'],
                filename: 'options.html',
            }))
            return webpackConfig
        },
        alias: {
            "@": path.resolve(__dirname, "src"),
            "@styles": path.resolve(__dirname, "src/styles"),
            "@player": path.resolve(__dirname, "src/player"),
        },
        plugins: { // 喵的这里有坑....这个plugins比上面的configure早执行...HtmlWebpackPlugin别放这里，不然找不到对应chunks
            add: [
                new ProgressBarPlugin({
                    complete: "█",
                    format: `${chalk.green('Building')} [ ${chalk.green(':bar')} ] ${chalk.bold(':percent')}`,
                    clear: false
                }),
            ]
        },
    },
    devServer: {
        devMiddleware: {
            writeToDisk: true,
        },
    },
}
