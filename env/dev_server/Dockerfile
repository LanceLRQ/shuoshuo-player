FROM golang:1.23

ENV GOPROXY=https://goproxy.cn,direct

RUN go install github.com/air-verse/air@latest

RUN go install github.com/swaggo/swag/cmd/swag@latest

RUN mkdir /app

WORKDIR /app

CMD ["tail", "-f", "/dev/null"]