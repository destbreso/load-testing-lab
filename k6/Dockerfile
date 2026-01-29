# Etapa 1: construir k6 con xk6 y extensión InfluxDB
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git

# Instalar xk6
RUN go install go.k6.io/xk6/cmd/xk6@latest

# Crear directorio de trabajo
WORKDIR /src

# Construir k6 con la extensión
RUN xk6 build --with github.com/grafana/xk6-output-influxdb@latest --output /src/k6

# Etapa 2: copiar binario en la imagen oficial de k6
FROM grafana/k6:0.49.0

# Copiar el binario generado en /usr/bin/k6
COPY --from=builder /src/k6 /usr/bin/k6

# Copiar el script de entrypoint (debe tener permisos de ejecución en el host)
COPY entrypoint.sh /entrypoint.sh

# Usar el entrypoint personalizado
ENTRYPOINT ["/entrypoint.sh"]
