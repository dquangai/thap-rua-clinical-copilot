# API xác thực bác sĩ

Base URL khi phát triển: `http://localhost:4000/api/v1/auth`.

Tài khoản bác sĩ được tạo bởi người quản trị trong **Supabase Dashboard → Authentication → Users**. Backend không cung cấp API đăng ký công khai.

## Đăng nhập

`POST /login`

```json
{
  "email": "doctor@example.com",
  "password": "your-password"
}
```

Response `200`:

```json
{
    "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6IjcwZDViODcxLWY2NmMtNGI2Ni05NjYyLTgwNTY0OWRmYjg1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2NpZ3BwbmpycXBtbWtrdGR2aXJvLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI5NzI0YTlmYy0yZTY0LTRiOTQtYTEwYi1mNDVmMDZlMjIyY2YiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzg0MjgzOTI2LCJpYXQiOjE3ODQyODAzMjYsImVtYWlsIjoiYWRtaW5AZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODQyODAzMjZ9XSwic2Vzc2lvbl9pZCI6ImFjOTk0YmZjLThkOTUtNGU5MS1hN2ExLTlmOGFlNDE3Nzk2OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.J1hkpUq-XARwxWXLBAjFj_yEsARxGs5E2wVC_2VFM_pt3WTsGDTn3Tjcb8EdQCP9Ar-uU-5xlzr6BucPdOIacA",
    "refresh_token": "ys6ubyy7bseq",
    "token_type": "bearer",
    "expires_in": 3600,
    "expires_at": 1784283926
}
```

Sai email hoặc mật khẩu trả về `401`. Không log password, access token hoặc refresh token.

## Lấy tài khoản hiện tại

`GET /me`

Header:

```http
Authorization: Bearer <access_token>
```

Response `200`:

```json
{
  "id": "<auth-user-uuid>",
  "email": "doctor@example.com"
}
```

## Làm mới token

`POST /refresh`

```json
{
  "refresh_token": "..."
}
```

Response trả về một cặp access/refresh token mới cùng định dạng endpoint login. Client phải thay cả hai token cũ.

## Đăng xuất

`POST /logout`

Header:

```http
Authorization: Bearer <access_token>
```

Response thành công: `204 No Content`.

## Sử dụng access token

Mọi API bệnh án gửi access token trong header:

```http
Authorization: Bearer <access_token>
```

Không lưu token trong source code. Với web production, ưu tiên session cookie `HttpOnly`, `Secure`, `SameSite` qua một Backend-for-Frontend; triển khai hiện tại trả token JSON để frontend demo tích hợp trực tiếp.
