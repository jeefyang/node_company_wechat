import * as superagent from "superagent"
import * as path from "path"
import * as fs from "fs"
import * as koa from "koa"
import{koaBody} from "koa-body"
import * as cors from "koa2-cors"


type configType = {
    /** Secret密钥 */
    "WECOM_CID": string,
    /** Secret密钥 */
    "WECOM_SECRET": string,
    /** AgentId */
    "WECOM_AID": string,
    /** 发送给谁,一般为@all */
    "WECOM_TOUID": string,
    /** 发送明文密钥,需要与链接对应 */
    "SendKey": string
    /** 监听端口 */
    "listenPort": number
}

type sendToWechat_opType = {
    content: string
    msgtype?: "text" | "markdown"
}
let configUrl = "./config.jsonc"
let str = fs.readFileSync(configUrl, "utf8")
let config: configType = eval("(" + str + ")")
async function sendToWechat(op: sendToWechat_opType) {

    const getTokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${config.WECOM_CID}&corpsecret=${config.WECOM_SECRET}`
    const getTokenRes = await superagent.get(getTokenUrl)
    const accessToken = (<any>getTokenRes.body).access_token
    if (accessToken.length <= 0) {
        throw new Error('获取 accessToken 失败')
    }
    const sendMsgUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`
    let sendData: any = {
        touser: config.WECOM_TOUID,
        agentid: config.WECOM_AID,
        duplicate_check_interval: 600,
    }
    if (op.msgtype == "markdown") {
        sendData.msgtype = "markdown"
        sendData.markdown = {
            content: op.content,
        }
    }
    else {
        sendData.msgtype = "text"
        sendData.text = {
            content: op.content,
        }

    }
    const sendMsgRes = await superagent.post(sendMsgUrl).send(sendData)
    console.log("发送成功")
    console.log(sendMsgRes.body)
    return sendMsgRes.body
}

// sendToWechat({
//     content: "123",
//     msgtype: "text"
// })

async function main() {
    let app = new koa()
    let port = Number(config.listenPort)
    app.use(cors())
    app.use(koaBody(
        {
            // 这个一定要加,会影响上传的文件的
            multipart: true
        }
    ))
    app.use(async ctx => {
        let url = ctx.url
        let start = 1
        let end = start + config.SendKey.length
        let sendKey = url.slice(start, end)
        // 密钥匹配
        if (sendKey != config.SendKey) {
            return
        }
        let getStr = "/get?send="
        let oldEnd = end
        start = end
        end = start + getStr.length
        let getStrKey = url.slice(start, end)
        console.log(getStrKey)
        if (getStrKey == getStr) {
            console.log("捕获get")
            start = end
            let msgStr = url.slice(start)
            msgStr = decodeURI(msgStr)
            console.log(msgStr)
            let msg = await sendToWechat({
                content: msgStr,
                msgtype: "text"
            })
            return msg
        }
        let postStr = "/post"
        start = oldEnd
        end = start + postStr.length
        let postStrKey = url.slice(start, end)
        if (postStrKey == postStr) {
            console.log("捕获post")
            console.log(ctx.request.body)
            let op: sendToWechat_opType = ctx.request.body
            console.log(op)
            if (!op || op.content == undefined || op.msgtype == undefined) {
                console.warn('提供数据错误')
                return
            }
            console.log(op)
            return
            // let msg = await sendToWechat(op)
            // return msg
        }
        console.log(sendKey)
    })
    app.listen(port, "localhost", () => {
        console.log(`开始运行微信监听,http://localhost:${port}`)
    })
}

main()

// sendToWechat({
//     content:
//         `# 娃哈哈
//     ### 你是谁
//     `,
//     msgtype: "markdown"
// })