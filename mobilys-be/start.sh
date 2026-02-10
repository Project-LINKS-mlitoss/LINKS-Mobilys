# This script is used to start the Docker containers for the application.
# It takes one argument, which specifies the environment to run the application in.
# Usage: ./start.sh [dev|prod]
# Whenever there is a new environment, add a new docker-compose file and update this script accordingly.

ENV=$1

if [ "$ENV" = "dev" ]; then
  docker-compose -f docker-compose.yml up --build
elif [ "$ENV" = "prod" ]; then
  docker-compose -f docker-compose.yml up --build mobilys_be
else
  echo "Usage: ./start.sh [dev|prod]"
fi
