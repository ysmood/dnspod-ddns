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
    .option('-i, --interval <num>', 'poll interval', 1000)
    .parse(process.argv)

var lastIp
async function checkIp () {
    try {
        const ip = cmder.usePublicIp ? await publicIp.v4() : await internalIp.v4()

        if (lastIp !== ip) {
            await setRecord(ip)
            lastIp = ip
        }
    } catch (err) {
        kit.errs(err)
    } finally {
        setTimeout(checkIp, cmder.interval);
    }
}

async function setRecord (ip) {
    const recordId = await getRecordId()

    await req('Record.Modify', {
        domain: cmder.domainName,
        sub_domain: cmder.subDomain,
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
            domain: cmder.domainName,
            sub_domain: cmder.subDomain
        })).records[0].id
    } catch (err) {
        if (err.message === 'No records') {
            return (await req('Record.Create', {
                domain: cmder.domainName,
                sub_domain: cmder.subDomain,
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
        login_token: cmder.token,
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

checkIp()