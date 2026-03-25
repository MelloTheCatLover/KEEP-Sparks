import app from "./server";

const port = 8080;

app.listen(port, (): void => {
  console.log(`server is running on ${port}`);
});
