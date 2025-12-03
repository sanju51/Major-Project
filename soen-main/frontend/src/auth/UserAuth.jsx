import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { UserContext } from '../context/user.context'

const UserAuth = ({ children }) => {

    const { user } = useContext(UserContext)
    const [ loading, setLoading ] = useState(true)
    const token = localStorage.getItem('token')
    const navigate = useNavigate()
    const location = useLocation()




    useEffect(() => {
        if (user) {
            setLoading(false)
        }

        if (!token) {
            navigate('/login')
            return
        }

        if (!user) {
            navigate('/login')
            return
        }

        if (user && !user.username && location.pathname !== '/onboarding') {
            navigate('/onboarding')
            return
        }

    }, [user, token, location.pathname])

    if (loading) {
        return <div>Loading...</div>
    }


    return (
        <>
            {children}</>
    )
}

export default UserAuth
