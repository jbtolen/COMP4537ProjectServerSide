// src/swagger.js
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "COMP4977 API Documentation",
      version: "1.0.0",
      description: "API service for COMP4977 project using Node.js",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    servers: [
      {
        url: "https://comp4537projectserverside.azurewebsites.net/api"  // CHANGE THIS!
      },
    ],
  },
  apis: ["./src/**/*.js"],  // Scan ALL js files for Swagger comments
};

const swaggerSpec = swaggerJsDoc(options);

function swaggerDocs(app) {
  app.use("/doc", swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // REQUIRED: /doc
}

module.exports = swaggerDocs;
