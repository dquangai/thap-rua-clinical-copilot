import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 4000)

const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200)
    response.end(JSON.stringify({ status: 'ok', service: 'clinical-api' }))
    return
  }

  response.writeHead(404)
  response.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(port, () => {
  console.log(`Clinical API listening on http://localhost:${port}`)
})
