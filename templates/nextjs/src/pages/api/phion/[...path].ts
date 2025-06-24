import { NextApiRequest, NextApiResponse } from "next"
import { createToolbarHandler } from "phion/plugin-next"

const handler = createToolbarHandler()

export default function phionApi(req: NextApiRequest, res: NextApiResponse) {
  return handler(req, res)
}
