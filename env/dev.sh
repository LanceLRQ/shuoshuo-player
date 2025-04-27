#!/bin/bash

COMPOSE_NAME="ss-cloud-dev"

case "$1" in
  "start"|"up")
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME up -d;;
  "stop"|"down")
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME down;;
  "restart")
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME down
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME up -d
   ;;
  "ps")
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME ps;;
  "logs")
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME logs ${@:2};;
  "exec")
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME exec dev_server ${@:2};;
  "bash")
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME exec dev_server bash;;
  "watch")
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME logs -f dev_server;;
  "create-super-user")
    docker-compose -f docker-compose.yml -p $COMPOSE_NAME exec dev_server go run . create-super-account $2;;
  "cd")
    exit;;
  *)
    echo "Shoushuo Cloud Service Development Management Script";;
esac