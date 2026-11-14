import { defineHandler } from "nitro";
import { onlinePaymentsEnabled } from "../../utils/payments";

export default defineHandler(() => ({ onlinePaymentsEnabled }));
