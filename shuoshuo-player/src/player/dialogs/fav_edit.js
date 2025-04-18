import React, {useState, forwardRef, useImperativeHandle, useEffect} from 'react';
import {
    Box, Button, TextField, Dialog, DialogTitle, DialogActions, DialogContent,
    FormControl, FormLabel, FormControlLabel, RadioGroup, Radio, List,
    ListItemIcon, ListItemButton, ListItemText

} from '@mui/material';
import * as yup from 'yup';
import { useFormik } from 'formik';
import {useDispatch, useSelector} from "react-redux";
import {FavListSlice} from "@/store/play_list";
import {FavListType, MasterUpInfo, NoticeTypes} from "@/constants";
import {PlayerNoticesSlice} from "@/store/ui";
import API from "@/api";
import {useNavigate} from "react-router";
import {BilibiliUserInfoSlice} from "@/store/bilibili";

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
    const [fromMid, setFromMid] = useState('');
    const [fromName, setFromName] = useState('');
    const favList = useSelector(FavListSlice.selectors.favList);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [bilibiliMyFavList, setBilibiliMyFavList] = useState([]);
    const validationSchema = yup.object({
        id: yup.string(),
        name: yup
            .string()
            .max(64, '歌单名称不能超过64个字符')
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
                if (ctx.parent?.id) return true;
                if (Number(ctx.parent?.type) === FavListType.CUSTOM || Number(ctx.parent?.type) === FavListType.BILI_FAV) return true;
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
            id: '',
            name: '未命名歌单',
            type: FavListType.CUSTOM,
            upUrl: '',
            biliFavFolder: '',
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {
            if (values?.id) {
                dispatch(FavListSlice.actions.modFavList({
                    favId: values.id,
                    name: values.name,
                }))
                setOpen(false);
            }
            else {
                // 处理Up主歌单
                if (Number(values.type) === FavListType.UPLOADER) {
                    const mid = getBilibiliMidByURL(values.upUrl);
                    // 如果mid是主up的，或者是已存在，则跳过
                    if (String(mid) === String(MasterUpInfo.mid) || favList.find(item => item.type === FavListType.UPLOADER && Number(item.mid) === Number(mid))) {
                        dispatch(PlayerNoticesSlice.actions.sendNotice({
                            type: NoticeTypes.WARN,
                            message: '该用户的歌单已存在，无法添加',
                            duration: 3000,
                        }));
                        return;
                    }
                    API.Bilibili.UserApi.getUserSpaceInfo({
                        params: {mid}
                    }).then((res) => {
                        dispatch(FavListSlice.actions.addFavList({
                            mid,
                            type: FavListType.UPLOADER,
                            name: values.name || `${res?.name ?? mid}的歌单`
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
                // 处理自定义歌单
                } else if (Number(values.type) === FavListType.CUSTOM) {
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
                // 处理收藏夹歌单
                } else if (Number(values.type) === FavListType.BILI_FAV) {
                    if (!values.biliFavFolder) return;
                    const fInfo = values.biliFavFolder.split(':::')
                    if (fInfo.length !== 2) return;
                    dispatch(FavListSlice.actions.addFavList({
                        type: FavListType.BILI_FAV,
                        name: `[${fromName ? fromName : biliUser?.uname}]${fInfo[1]}`,
                        mid: fromMid ? fromMid : biliUser?.mid,
                        biliFavFolderId: fInfo[0],
                    })).then(res => {
                        if (res?.payload?.status) {
                            const favId = res?.payload?.data?.id;
                            navigate(`/fav/${favId}`);
                        }
                    })
                    setOpen(false);
                }
            }
        },
    });
    const biliUser = useSelector(BilibiliUserInfoSlice.selectors.currentUser);
    // 弹出对话框
    const showDialog = (payload) => {
        const { id = 0, mid = '', name = '' } = payload;
        setFavId(id);
        setFromMid(mid);
        setFromName(name);
        setOpen(true);
        if (id) {
            const favInfo = favList.find(item => item.id === id);
            if (!favInfo) {
                dispatch(PlayerNoticesSlice.actions.sendNotice({
                    type: NoticeTypes.ERROR,
                    message: '歌单不存在',
                    duration: 3000,
                }));
                return;
            }
            formik.resetForm({
                values: favInfo
            })
        } else {
            if (mid) {
                formik.resetForm({
                    values: {
                        type: FavListType.UPLOADER,
                        name: name || '未命名歌单',
                        upUrl: mid,
                    }
                })
            } else {
                formik.resetForm({
                    values: {}
                })
            }
        }
    };
    const handleClose = () => {
        setOpen(false);
    };

    useImperativeHandle(ref, () => ({
        showDialog,
    }))

    useEffect(() => {
        if (Number(formik.values.type) === FavListType.BILI_FAV && !bilibiliMyFavList.length) {
            API.Bilibili.UserApi.getMyFavoriteFolder({
                params: {
                    up_mid: fromMid ? fromMid : biliUser.mid
                }
            }).then(res => {
                setBilibiliMyFavList(res?.list ?? [])
            });
        }
    }, [formik.values, bilibiliMyFavList, biliUser, fromMid])

    return <Dialog
        open={open}
        onClose={handleClose}
        scroll="paper"
    >
        <DialogTitle>{favId ? '编辑歌单' : '新建歌单'}</DialogTitle>
        <form onSubmit={formik.handleSubmit}>
            <DialogContent dividers>
                <Box
                    sx={{
                        width: 480,
                        maxWidth: '100%',
                    }}
                >
                    {!favId ? <FormControl>
                        <FormLabel>歌单类型</FormLabel>
                        <RadioGroup
                            row
                            name="type"
                            value={formik.values.type}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                        >
                            <FormControlLabel value={FavListType.UPLOADER} control={<Radio />} label="Up主歌单" />
                            {!fromMid ? <FormControlLabel value={FavListType.CUSTOM} control={<Radio />} label="自定义歌单" /> : null}
                            <FormControlLabel value={FavListType.BILI_FAV} control={<Radio />} label={`B站收藏夹(${fromMid ? fromName : biliUser?.uname})`} />
                        </RadioGroup>
                    </FormControl> : null}
                    {(favId || (Number(formik.values.type) === FavListType.UPLOADER && fromName) || Number(formik.values.type) === FavListType.CUSTOM) ? <TextField
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
                    {(!favId && Number(formik.values.type) === FavListType.UPLOADER) ? <TextField
                        autoFocus
                        required
                        margin="dense"
                        name="upUrl"
                        value={formik.values.upUrl}
                        label="B站UP主空间链接或UID"
                        placeholder="e.g. https://space.bilibili.com/283886865 或 283886865"
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.upUrl && Boolean(formik.errors.upUrl)}
                        helperText={formik.touched.upUrl && formik.errors.upUrl}
                        fullWidth
                        variant="standard"
                    /> : null}
                    {(!favId && Number(formik.values.type) === FavListType.BILI_FAV) ? <List sx={{ maxHeight: 300, overflowY: 'auto'}}>
                        {bilibiliMyFavList.map((item, index) => {
                            const key = `${item.id}:::${item.title}`;
                            return <ListItemButton key={key} onClick={() => formik.setFieldValue('biliFavFolder', key)} dense>
                                <ListItemIcon>
                                    <Radio
                                        edge="start"
                                        value={key}
                                        checked={formik.values.biliFavFolder === key}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                        tabIndex={index}
                                    />
                                </ListItemIcon>
                                <ListItemText primary={item.title} />
                            </ListItemButton>
                        })}
                    </List> : null}
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