import React, {useState, forwardRef, useImperativeHandle} from 'react';
import { Box, Button, TextField, Dialog, DialogTitle, DialogActions, DialogContent } from '@mui/material';
import * as yup from 'yup';
import { useFormik } from 'formik';
import {useDispatch} from "react-redux";
import {FavListSlice} from "@/store/play_list";
import {FavListType} from "@/constants";

const FavEditDialog = forwardRef((props, ref) => {

    const [open, setOpen] = useState(false);
    const [favId, setFavId] = useState(0);
    const dispatch = useDispatch();
    const validationSchema = yup.object({
        name: yup
            .string('输入歌单名称')
            .max(16, '歌单名称不能超过16个字符')
            .required('歌单名称必填'),
    });
    const formik = useFormik({
        initialValues: {
            name: '未命名歌单',
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {
            dispatch(FavListSlice.actions.addFavList({
                type: FavListType.CUSTOM,
                name: values.name,
            }))
            setOpen(false);
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
                        width: 360,
                        maxWidth: '100%',
                    }}
                >
                    <TextField
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
                    />
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