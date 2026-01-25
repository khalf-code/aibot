export function isErrno(err, code) {
    return (!!err && typeof err === "object" && "code" in err && err.code === code);
}
