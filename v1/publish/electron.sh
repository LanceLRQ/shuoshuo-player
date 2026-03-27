#!/bin/sh

SCRIPT_DIR=$(pwd)
WORK_DIR=$(dirname $(pwd))/shuoshuo-player
PC_DIR=$(dirname $(pwd))/shuoshuo-player-pc

if [ ! -d $WORK_DIR ]; then
  echo "$WORK_DIR not exists!";
  exit;
fi
if [ ! -d $PC_DIR ]; then
  echo "$PC_DIR not exists!";
  exit;
fi

cd $WORK_DIR
yarn build

cd $PC_DIR
yarn make