import React, {forwardRef, useImperativeHandle, useState} from 'react';
import {
    Dialog, DialogContentText, DialogTitle, DialogContent, DialogActions, Button, TextField
} from "@mui/material";
import {useDispatch} from "react-redux";
import {useFormik} from "formik";
import * as yup from "yup";
import API from "@/api";
import {PlayerNoticesSlice} from "@/store/ui";
import {NoticeTypes} from "@/constants";
import {CloudServiceSlice} from "@/store/cloud_service";

const CloudLoginDialog =  forwardRef((props, ref) => {
    const [open, setOpen] = useState(false);
    const dispatch = useDispatch();

    const validationSchema = yup.object({
        id: yup.string(),
        email: yup.string().email('请输入有效的邮箱地址').required('请输入邮箱地址'),
        password: yup.string().required('请输入密码'),
    });

    const formik = useFormik({
        initialValues: {
            email: '',
            password: '',
        },
        validationSchema,
        onSubmit: (values) => {
            API.CloudService.Account.login({
                data: values
            }).then((resp) => {
                dispatch(CloudServiceSlice.actions.updateSession(resp))
                dispatch(PlayerNoticesSlice.actions.sendNotice({
                    type: NoticeTypes.SUCCESS,
                    message: '登录成功',
                    duration: 3000,
                }));
                handleClose();
            }).catch(resp => {
                dispatch(PlayerNoticesSlice.actions.sendNotice({
                    type: NoticeTypes.ERROR,
                    message: resp.message,
                    duration: 3000,
                }));
            });
        },
    });

    const showDialog = () => {
        formik.resetForm({})
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    // const handleTest = () => {
    //     API.CloudService.Account.getAccountsList().then((resp) => {
    //         console.log(resp);
    //     }).catch((resp)=> console.log(resp));
    // }

    useImperativeHandle(ref, () => ({
        showDialog,
    }))

    return <Dialog
        open={open}
        onClose={handleClose}
    >
        <DialogTitle>登录云服务</DialogTitle>
        <form onSubmit={formik.handleSubmit}>
            <DialogContent>
                <TextField
                    autoFocus
                    required
                    margin="dense"
                    name="email"
                    value={formik.values.email}
                    label="邮箱"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.email && Boolean(formik.errors.email)}
                    helperText={formik.touched.email && formik.errors.email}
                    fullWidth
                    variant="standard"
                />
                <TextField
                    required
                    margin="dense"
                    name="password"
                    type="password"
                    value={formik.values.password}
                    label="密码"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.password && Boolean(formik.errors.password)}
                    helperText={formik.touched.password && formik.errors.password}
                    fullWidth
                    variant="standard"
                />
                <DialogContentText sx={{margin: "16px 0"}}>
                    此功能为内部管理员登录云平台使用。 <br />
                    并且，我们不会记录你的B站登录信息，请放心使用。
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button type="button" onClick={handleClose}>取消</Button>
                <Button type="submit">登录</Button>
            </DialogActions>
        </form>
    </Dialog>
});

export default CloudLoginDialog;