const kit = require('nokit')
const internalIp = require('internal-ip');
const publicIp = require('public-ip');
const cmder = require('commander')

const { _ } = kit

cmder
    .version(require('../package.json').version)
    .option('-t, --token <str>')
    .option('-d, --domain-name <str>')
    .option('-p, --use-public-ip')
    .option('-s, --sub-domain <str>')
    .parse(process.argv)

;(async (options) => {
    await checkIp()

    setInterval(checkIp, 1000 * 60)

    var lastIp
    async function checkIp () {
        const ip = cmder.usePublicIp ? await publicIp.v4() : await internalIp.v4()

        if (lastIp !== ip) {
            lastIp = ip
            await setRecord(ip)
        }
    }

    async function setRecord (ip) {
        const recordId = await getRecordId()

        await req('Record.Modify', {
            domain: options.domainName,
            sub_domain: options.subDomain,
            record_id: recordId,
            record_type: 'A',
            record_line: '默认',
            value: ip
        })

        kit.logs('set ip to:', ip)
    }

    async function getRecordId () {
        try {
            return (await req('Record.List', {
                domain: options.domainName,
                sub_domain: options.subDomain
            })).records[0].id
        } catch (err) {
            if (err.message === 'No records') {
                return (await req('Record.Create', {
                    domain: options.domainName,
                    sub_domain: options.subDomain,
                    record_type: 'A',
                    record_line: '默认',
                    value: '0.0.0.0'
                })).record.id
            } else {
                throw err
            }
        }
    }
    
    async function req (path, opts = {}) {
        Object.assign(opts, {
            login_token: options.token,
            format: 'json'
        })

        const body = await kit.request({
            method: 'POST',
            url: `https://dnsapi.cn/${path}`,
            reqData: opts
        })

        const data = JSON.parse(body)

        if (data.status.code !== '1') {
            throw new Error(data.status.message)
        }

        return data
    }

})(cmder).catch((err) => {
    kit.logs(err)
})
