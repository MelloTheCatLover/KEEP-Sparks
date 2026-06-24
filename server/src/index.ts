import app from "./server";
import { env } from "./config/env";

app.listen(env.port, (): void => {
  console.log(`server is running on ${env.port}`);
});
