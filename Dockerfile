# Use node 4.4.5 LTS
FROM node:10

# Change working directory
WORKDIR ./fourdd

COPY ./fourdd/package*.json ./

# Install dependencies
RUN npm install

COPY . . 

# Expose API port to the outside
EXPOSE 8080

# Launch application
CMD ["node", "fourdd/fourdd.js", "--host=0.0.0.0", "--port=8080", "--catchup=true"]
