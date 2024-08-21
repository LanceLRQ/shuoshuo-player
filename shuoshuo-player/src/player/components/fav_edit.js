import React, {useState, forwardRef, useImperativeHandle} from 'react';
import {
    Box, Button, TextField, Dialog, DialogTitle, DialogActions, DialogContent,
    FormControl, FormLabel, FormControlLabel, RadioGroup, Radio

} from '@mui/material';
import * as yup from 'yup';
import { useFormik } from 'formik';
import {useDispatch, useSelector} from "react-redux";
import {FavListSlice} from "@/store/play_list";
import {FavListType, MasterUpInfo, NoticeTypes} from "@/constants";
import {PlayerNoticesSlice} from "@/store/ui";
import API from "@/api";
import {useNavigate} from "react-router";

const getBilibiliMidByURL = (upUrl) => {
    const bUrlMatch = upUrl.match(/https:\/\/space.bilibili.com\/(\d+)/);
    const midMatch = upUrl.match(/^(\d+)$/);
    if (!bUrlMatch && !midMatch) {
        return null;
    }
    return bUrlMatch?.[1] || midMatch?.[1];
}

const FavEditDialog = forwardRef((props, ref) => {

    const [open, setOpen] = useState(false);
    const [favId, setFavId] = useState(0);
    const favList = useSelector(FavListSlice.selectors.favList);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const validationSchema = yup.object({
        name: yup
            .string()
            .max(16, '歌单名称不能超过16个字符')
            .test({
                name: 'name-test',
                test(value, ctx) {
                    const { type } = ctx.parent;
                    if (Number(type) === FavListType.CUSTOM && !(value || '').trim()) {
                        return ctx.createError({ message: '歌单名称必填' })
                    }
                    return true
                }
            }),
        type: yup.number(),
        upUrl: yup.string().test({
            name: 'bili-url-test',
            test(value, ctx) {
                if (Number(ctx.parent?.type) === FavListType.CUSTOM) return true;
                const upUrl = String(ctx.parent?.upUrl || '').trim();
                if (!upUrl) {
                    return ctx.createError({ message: '地址或者UID必填' })
                }
                const mid = getBilibiliMidByURL(upUrl);
                if (!mid) {
                    return ctx.createError({ message: 'B站UP主UID解析错误' })
                }
                return true
            }
        }),
    });
    const formik = useFormik({
        initialValues: {
            name: '未命名歌单',
            type: FavListType.CUSTOM,
            upUrl: '',
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {
            if (Number(values.type) === FavListType.UPLOADER) {
                const mid = getBilibiliMidByURL(values.upUrl);
                // 如果mid是主up的，或者是已存在，则跳过
                if(String(mid) === String(MasterUpInfo.mid) || favList.find(item => item.type === FavListType.UPLOADER &&  Number(item.mid) === Number(mid))) {
                    dispatch(PlayerNoticesSlice.actions.sendNotice({
                        type: NoticeTypes.WARN,
                        message: '该用户的歌单已存在，无法添加',
                        duration: 3000,
                    }));
                    return;
                }
                API.Bilibili.UserApi.getUserSpaceInfo({
                    params: { mid }
                }).then((res) => {
                    dispatch(FavListSlice.actions.addFavList({
                        mid,
                        type: FavListType.UPLOADER,
                        name: `${res?.name??mid}的歌单`
                    })).then(res => {
                        if (res?.payload?.status) {
                            const favId = res?.payload?.data?.id;
                            navigate(`/fav/${favId}`);
                        }
                    });
                    setOpen(false);
                }).catch(e => {
                    console.log(e);
                    dispatch(PlayerNoticesSlice.actions.sendNotice({
                        type: NoticeTypes.WARN,
                        message: '该B站用户不存在',
                        duration: 3000,
                    }));
                });
            } else {
                dispatch(FavListSlice.actions.addFavList({
                    type: FavListType.CUSTOM,
                    name: values.name,
                })).then(res => {
                    if (res?.payload?.status) {
                        const favId = res?.payload?.data?.id;
                        navigate(`/fav/${favId}`);
                    }
                })
                setOpen(false);
            }
        },
    });
    const showDialog = (payload) => {
        const { id = 0 } = payload;
        setFavId(favId);
        setOpen(true);
        if (id) {
            formik.resetForm({})
        } else {
            formik.resetForm()
        }
    };
    const handleClose = () => {
        setOpen(false);
    };

    useImperativeHandle(ref, () => ({
        showDialog,
    }))

    return <Dialog
        open={open}
        onClose={handleClose}
    >
        <DialogTitle>{favId ? '编辑歌单' : '新建歌单'}</DialogTitle>
        <form onSubmit={formik.handleSubmit}>
            <DialogContent>
                <Box
                    sx={{
                        width: 480,
                        maxWidth: '100%',
                    }}
                >
                    <FormControl>
                        <FormLabel>歌单类型</FormLabel>
                        <RadioGroup
                            row
                            name="type"
                            value={formik.values.type}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                        >
                            <FormControlLabel value={FavListType.UPLOADER} control={<Radio />} label="Up主歌单" />
                            <FormControlLabel value={FavListType.CUSTOM} control={<Radio />} label="自定义歌单" />
                        </RadioGroup>
                    </FormControl>
                    {Number(formik.values.type) === FavListType.CUSTOM ? <TextField
                        autoFocus
                        required
                        margin="dense"
                        name="name"
                        value={formik.values.name}
                        label="歌单名称"
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.name && Boolean(formik.errors.name)}
                        helperText={formik.touched.name && formik.errors.name}
                        fullWidth
                        variant="standard"
                    /> : null}
                    {Number(formik.values.type) === FavListType.UPLOADER ? <TextField
                        autoFocus
                        required
                        margin="dense"
                        name="upUrl"
                        value={formik.values.upUrl}
                        label="B站UP主空间链接或UID"
                        placeholder="例如：https://space.bilibili.com/283886865 或 283886865"
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.upUrl && Boolean(formik.errors.upUrl)}
                        helperText={formik.touched.upUrl && formik.errors.upUrl}
                        fullWidth
                        variant="standard"
                    /> : null}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button type="button" onClick={handleClose}>取消</Button>
                <Button type="submit">确定</Button>
            </DialogActions>
        </form>
    </Dialog>;
})

export default FavEditDialog;