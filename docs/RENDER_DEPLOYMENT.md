# Deploy KaamKart on Render

This guide will help you deploy KaamKart on Render platform.

## Prerequisites

- A Render account (sign up at [render.com](https://render.com))
- GitHub repository with your code
- MySQL database (can be provisioned on Render)

## Deployment Steps

### 1. Create a MySQL Database on Render

1. Go to your Render dashboard
2. Click "New +" → "PostgreSQL" (or MySQL if available)
3. Choose a name: `kaamkart-db`
4. Select a plan (Free tier available)
5. Note down the connection details:
   - Internal Database URL
   - External Database URL
   - Database Name
   - Username
   - Password

### 2. Initialize Database

1. Connect to your database using a MySQL client
2. Run the SQL script: `kaamkartApi/kaamkart-database.sql`
   ```bash
   mysql -h <host> -u <user> -p <database> < kaamkartApi/kaamkart-database.sql
   ```

### 3. Deploy Backend API

1. Go to Render dashboard → "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `kaamkart-api`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./kaamkartApi/Dockerfile`
   - **Docker Context**: `./kaamkartApi`
   - **Build Command**: (leave empty, handled by Dockerfile)
   - **Start Command**: (leave empty, handled by Dockerfile)
4. Add Environment Variables:
   ```
   SPRING_PROFILES_ACTIVE=prod
   SPRING_DATASOURCE_URL=jdbc:mysql://<host>:<port>/<database>
   SPRING_DATASOURCE_USERNAME=<username>
   SPRING_DATASOURCE_PASSWORD=<password>
   JWT_SECRET=<generate-a-secret-key>
   PORT=8585
   ```
5. Click "Create Web Service"
6. Wait for deployment to complete
7. Note the service URL (e.g., `https://kaamkart-api.onrender.com`)

### 4. Deploy Frontend UI

1. Go to Render dashboard → "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `kaamkart-ui`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./kaamkartUI/Dockerfile`
   - **Docker Context**: `./kaamkartUI`
   - **Build Command**: (leave empty, handled by Dockerfile)
   - **Start Command**: (leave empty, handled by Dockerfile)
4. Add Environment Variables:
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://kaamkart-api.onrender.com/api
   PORT=3000
   ```
5. Click "Create Web Service"
6. Wait for deployment to complete
7. Your app will be available at the service URL

### 5. Alternative: Using render.yaml (Recommended)

1. Push `render.yaml` to your repository
2. Go to Render dashboard → "New +" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and create all services
5. Update environment variables in the dashboard:
   - Database connection details
   - JWT_SECRET
   - NEXT_PUBLIC_API_URL (pointing to your API service)

## Environment Variables

### Backend API

| Variable | Description | Example |
|----------|-------------|---------|
| `SPRING_PROFILES_ACTIVE` | Spring profile | `prod` |
| `SPRING_DATASOURCE_URL` | Database connection URL | `jdbc:mysql://host:port/db` |
| `SPRING_DATASOURCE_USERNAME` | Database username | `kaamkart_user` |
| `SPRING_DATASOURCE_PASSWORD` | Database password | `your_password` |
| `JWT_SECRET` | JWT signing secret | `generate-secret-key` |
| `PORT` | Server port | `8585` |

### Frontend UI

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://kaamkart-api.onrender.com/api` |
| `PORT` | Server port | `3000` |

## Custom Domain

1. Go to your service settings
2. Click "Custom Domains"
3. Add your domain
4. Update DNS records as instructed
5. SSL certificate is automatically provisioned

## Monitoring

- Health Check: `https://your-api-url.onrender.com/api/health`
- View logs in Render dashboard
- Set up alerts for service downtime

## Troubleshooting

### Docker Build Timeout Errors

If you see errors like `failed to resolve source metadata` or `i/o timeout`:
- **This is usually a temporary network issue on Render's infrastructure**
- **Solution**: Simply retry the deployment (wait 2-3 minutes between retries)
- The error occurs when Render tries to pull Docker base images
- If it persists after multiple retries, check Render's status page

### Backend Issues

- Check logs in Render dashboard
- Verify database connection string
- Ensure JWT_SECRET is set
- Check if port is correctly configured

### Frontend Issues

- Verify NEXT_PUBLIC_API_URL points to correct API URL
- Check build logs for errors
- Ensure environment variables are set

### Database Issues

- Verify database is accessible
- Check connection credentials
- Ensure database is initialized with schema

## Cost Optimization

- Use Free tier for development/testing
- Upgrade to Starter/Standard for production
- Monitor usage in Render dashboard
- Consider using Render's PostgreSQL instead of MySQL if available

## Support

For Render-specific issues, check:
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)

