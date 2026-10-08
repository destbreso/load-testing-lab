# Etapa 1: construir k6 con xk6 y extensión InfluxDB
FROM golang:1.26-alpine AS builder

# Si xk6 o sus dependencias piden un Go más nuevo, se descarga en vez de fallar
ENV GOTOOLCHAIN=auto

RUN apk add --no-cache git

# Instalar xk6
RUN go install go.k6.io/xk6/cmd/xk6@v1.4.14

# Crear directorio de trabajo
WORKDIR /src

# Construir k6 con la extensión. Las versiones van fijadas: la extensión está hecha
# para k6 v1, y un k6 v2 compilado con ella no registra el output xk6-influxdb
RUN xk6 build v1.8.1 --with github.com/grafana/xk6-output-influxdb@v0.7.0 --output /src/k6

# Etapa 2: copiar binario en la imagen oficial de k6
FROM grafana/k6:0.49.0

# Copiar el binario generado en /usr/bin/k6
COPY --from=builder /src/k6 /usr/bin/k6

# Copiar el script de entrypoint (debe tener permisos de ejecución en el host)
COPY entrypoint.sh /entrypoint.sh

# Usar el entrypoint personalizado
ENTRYPOINT ["/entrypoint.sh"]
